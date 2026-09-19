import type { OpenAIService } from '../../openai/openai.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { answerQuestion } from '../../generation/answer-question.js';
import type { RagGenerationService } from '../../generation/rag-generation.service.js';
import { createPipelineProfiling } from '../../profiling/pipeline-timings.js';
import type { RerankerService } from '../../reranking/reranker.service.js';
import type { E2EJudgeService } from '../e2e-judge.service.js';
import type { E2ESourceJudgeService } from '../e2e-source-judge.service.js';
import type { LegalMulticorpusEvaluationQuestion } from '../multicorpus-dataset.types.js';
import {
  buildMulticorpusCacheKey,
  readCachedResult,
  writeCachedResult,
} from './cache.js';
import type {
  E2EQuestionResult,
  E2EVariantResult,
  MulticorpusModelConfiguration,
} from './types.js';
import { logEvaluationProgress } from './progress.js';
import { classifyFailureStage } from './error-analyzer.js';

function expectedAbstention(question: LegalMulticorpusEvaluationQuestion): boolean {
  return (
    question.questionType === 'ambiguous' ||
    question.questionType === 'out-of-scope'
  );
}

async function runE2EVariant(
  prisma: PrismaService,
  openAIService: OpenAIService,
  rerankerService: RerankerService,
  generationService: RagGenerationService,
  judgeService: E2EJudgeService,
  sourceJudgeService: E2ESourceJudgeService,
  question: LegalMulticorpusEvaluationQuestion,
  modelConfiguration: MulticorpusModelConfiguration,
  enableRouting: boolean,
): Promise<E2EVariantResult> {
  const profiling = createPipelineProfiling();
  const pipelineResult = await answerQuestion(
    prisma,
    openAIService,
    rerankerService,
    generationService,
    question.question,
    {
      retrievalTopK: modelConfiguration.retrievalTopK,
      rerankTopK: modelConfiguration.rerankTopK,
      relativeScoreThreshold: modelConfiguration.relativeScoreThreshold,
      profiling,
      enableRouting,
    },
  );

  const judge = await judgeService.judgeQuestion({
    questionId: question.id,
    question: question.question,
    referenceAnswer: expectedAbstention(question) ? null : question.referenceAnswer,
    generatedAnswer: pipelineResult.answer,
    context: pipelineResult.context,
    expectedAbstention: expectedAbstention(question),
  });

  const sources = pipelineResult.sources.map((source) => ({
    sourceId: source.sourceId,
    chunkId: source.chunkId,
    articleNumber: source.articleNumber,
    content: source.content,
  }));

  const sourceJudge = await sourceJudgeService.judgeSources({
    questionId: question.id,
    question: question.question,
    referenceAnswer: expectedAbstention(question) ? null : question.referenceAnswer,
    generatedAnswer: pipelineResult.answer,
    expectedAbstention: expectedAbstention(question),
    sources,
    judgeResult: judge,
  });

  return {
    answer: pipelineResult.answer,
    sources: pipelineResult.sources.map((source) => ({
      corpusId: source.chunk.corpusId ?? 'unknown',
      articleNumber: source.articleNumber,
    })),
    profiling,
    judge,
    sourceJudge,
  };
}

export async function evaluateE2EQuestion(
  deps: {
    prisma: PrismaService;
    openAIService: OpenAIService;
    rerankerService: RerankerService;
    generationService: RagGenerationService;
    judgeService: E2EJudgeService;
    sourceJudgeService: E2ESourceJudgeService;
  },
  question: LegalMulticorpusEvaluationQuestion,
  modelConfiguration: MulticorpusModelConfiguration,
): Promise<E2EQuestionResult> {
  const baseline = await runE2EVariant(
    deps.prisma,
    deps.openAIService,
    deps.rerankerService,
    deps.generationService,
    deps.judgeService,
    deps.sourceJudgeService,
    question,
    modelConfiguration,
    false,
  );

  const routing = await runE2EVariant(
    deps.prisma,
    deps.openAIService,
    deps.rerankerService,
    deps.generationService,
    deps.judgeService,
    deps.sourceJudgeService,
    question,
    modelConfiguration,
    true,
  );

  const result: E2EQuestionResult = {
    questionId: question.id,
    questionType: question.questionType,
    difficulty: question.difficulty,
    expectedAbstention: expectedAbstention(question),
    baseline,
    routing,
    failureStage: 'none',
  };

  result.failureStage = classifyFailureStage({
    question,
    routing: undefined,
    retrieval: undefined,
    reranking: undefined,
    e2e: result,
  });

  return result;
}

export async function evaluateE2EQuestions(
  deps: {
    prisma: PrismaService;
    openAIService: OpenAIService;
    rerankerService: RerankerService;
    generationService: RagGenerationService;
    judgeService: E2EJudgeService;
    sourceJudgeService: E2ESourceJudgeService;
  },
  questions: LegalMulticorpusEvaluationQuestion[],
  modelConfiguration: MulticorpusModelConfiguration,
  options: {
    runDir: string;
    force: boolean;
    concurrency: number;
  },
): Promise<E2EQuestionResult[]> {
  const results: E2EQuestionResult[] = new Array(questions.length);
  let index = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    while (index < questions.length) {
      const current = index++;
      const question = questions[current]!;
      const cacheKey = buildMulticorpusCacheKey({
        questionId: question.id,
        mode: 'e2e',
        modelConfiguration,
      });

      if (!options.force) {
        const cached = await readCachedResult<E2EQuestionResult>(
          options.runDir,
          'e2e',
          cacheKey,
        );
        if (cached) {
          results[current] = cached;
          completed += 1;
          logEvaluationProgress('e2e', completed, questions.length, question.id, 'cache');
          continue;
        }
      }

      const result = await evaluateE2EQuestion(deps, question, modelConfiguration);
      results[current] = result;
      await writeCachedResult(options.runDir, 'e2e', cacheKey, result);
      completed += 1;
      logEvaluationProgress('e2e', completed, questions.length, question.id, 'eval');
    }
  }

  await Promise.all(
    Array.from({ length: options.concurrency }, () => worker()),
  );

  return results;
}
