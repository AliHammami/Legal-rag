import type { OpenAIService } from '../openai/openai.service.js';
import { DEFAULT_MULTICORPUS_GENERATION_MODEL } from './constants.js';
import type { GoldArticle } from './gold-article.js';
import { uniqueGoldArticles } from './gold-article.js';
import type {
  CorpusArticleRecord,
  MulticorpusCorpusArticleRegistry,
} from './load-corpus-article-index.js';
import type {
  LegalMulticorpusEvaluationQuestion,
  MulticorpusDifficulty,
  MulticorpusQuestionType,
} from './multicorpus-dataset.types.js';
import {
  MULTICORPUS_MULTI_CORPUS_CHAT_PROMPT,
  MULTICORPUS_SINGLE_CORPUS_CHAT_PROMPT,
} from './langchain/multicorpus-question-chat-prompts.js';
import { MulticorpusGeneratedQuestionsSchema } from './multicorpus-generated-questions.schema.js';
import { reconcileQuestionGoldArticles } from './reconcile-multicorpus-gold-articles.js';
import type { MultiCorpusArticleBundle } from './select-diverse-articles.js';

export interface GeneratedQuestionCandidate {
  question: string;
  goldCorpusIds: string[];
  goldArticles: string[];
  referenceAnswer: string;
  difficulty: MulticorpusDifficulty;
  questionType: MulticorpusQuestionType;
  sourceArticles?: string[];
}

function buildSingleCorpusPrompt(
  corpusId: string,
  articles: CorpusArticleRecord[],
  difficultyMix: MulticorpusDifficulty[],
): string {
  const articleBlocks = articles
    .map(
      (article, index) =>
        `[Article ${index + 1}]\ncorpusId: ${corpusId}\narticleNumber: ${article.articleNumber}\ncontent:\n${article.content.slice(0, 2200)}`,
    )
    .join('\n\n');

  return `Tu construis des questions d'évaluation pour un système RAG juridique français.

RÈGLES ABSOLUES:
- Ne jamais inventer un numéro d'article, une disposition ou une règle absente des textes fournis.
- Chaque question doit être answerable uniquement à partir des articles fournis ci-dessous.
- goldArticles doit lister uniquement les articles réellement nécessaires pour répondre.
- goldCorpusIds doit être ["${corpusId}"] pour chaque question.
- questionType doit être "single-corpus".
- referenceAnswer: concise, correcte, dérivée uniquement des textes fournis.
- Varier les formulations (cas pratiques, comparaisons, conditions, effets, distinctions).
- Ne pas produire plusieurs variantes lexicales d'une même question.
- sourceArticles doit contenir au minimum tous les goldArticles.

ARTICLES FOURNIS:
${articleBlocks}

Génère exactement ${articles.length} questions, une par article fourni.
Répartition de difficult? demandée: ${difficultyMix.join(', ')}.`;
}

function buildMultiCorpusPrompt(
  bundles: MultiCorpusArticleBundle[][],
  difficultyMix: MulticorpusDifficulty[],
): string {
  const bundleBlocks = bundles
    .map((bundle, index) => {
      const articles = bundle
        .map(
          (entry) =>
            `- corpusId: ${entry.corpusId}, articleNumber: ${entry.articleNumber}\n  content: ${entry.content}`,
        )
        .join('\n');
      return `[Scenario ${index + 1}]\n${articles}`;
    })
    .join('\n\n');

  return `Tu construis des questions d'évaluation multi-corpus pour un système RAG juridique français.

RÈGLES ABSOLUES:
- Ne jamais inventer un article ou une règle absente des textes fournis.
- Chaque question doit réellement nécessiter des informations de TOUS les corpus listés dans le scénario.
- goldCorpusIds doit contenir au moins 2 corpus distincts et correspondre aux corpus réellement nécessaires.
- goldArticles doit lister uniquement les articles réellement nécessaires.
- questionType = "multi-corpus".
- referenceAnswer dérivée uniquement des textes fournis.
- Ne pas ajouter artificiellement un second corpus si la question est essentiellement mono-corpus.

SCÉNARIOS:
${bundleBlocks}

Génère exactement ${bundles.length} questions, une par scénario.
Répartition de difficult? demandée: ${difficultyMix.join(', ')}.`;
}

export async function generateSingleCorpusQuestions(
  openAIService: OpenAIService,
  corpusId: string,
  articles: CorpusArticleRecord[],
  difficultyMix: MulticorpusDifficulty[],
  model = DEFAULT_MULTICORPUS_GENERATION_MODEL,
): Promise<GeneratedQuestionCandidate[]> {
  const promptValue = await MULTICORPUS_SINGLE_CORPUS_CHAT_PROMPT.invoke({
    userContent: buildSingleCorpusPrompt(corpusId, articles, difficultyMix),
  });

  const chatModel = openAIService.createChatModel(model);
  const structuredModel = chatModel.withStructuredOutput(
    MulticorpusGeneratedQuestionsSchema,
  );
  const response = await structuredModel.invoke(promptValue);

  return response.questions ?? [];
}

export async function generateMultiCorpusQuestions(
  openAIService: OpenAIService,
  bundles: MultiCorpusArticleBundle[][],
  difficultyMix: MulticorpusDifficulty[],
  model = DEFAULT_MULTICORPUS_GENERATION_MODEL,
): Promise<GeneratedQuestionCandidate[]> {
  const promptValue = await MULTICORPUS_MULTI_CORPUS_CHAT_PROMPT.invoke({
    userContent: buildMultiCorpusPrompt(bundles, difficultyMix),
  });

  const chatModel = openAIService.createChatModel(model);
  const structuredModel = chatModel.withStructuredOutput(
    MulticorpusGeneratedQuestionsSchema,
  );
  const response = await structuredModel.invoke(promptValue);

  return response.questions ?? [];
}

type QuestionCandidateInput = {
  question: string;
  goldCorpusIds: string[];
  goldArticles: string[] | GoldArticle[];
  referenceAnswer: string;
  difficulty: MulticorpusDifficulty;
  questionType: MulticorpusQuestionType;
  sourceArticles?: string[] | GoldArticle[];
};

function normalizeCandidateGoldArticles(
  candidate: QuestionCandidateInput,
  id: string,
  registry?: MulticorpusCorpusArticleRegistry,
): GoldArticle[] {
  const raw = candidate.goldArticles;
  if (raw.length === 0) {
    return [];
  }

  if (typeof raw[0] !== 'string') {
    return uniqueGoldArticles(raw as GoldArticle[]);
  }

  if (candidate.goldCorpusIds.length === 1) {
    return uniqueGoldArticles(
      (raw as string[]).map((articleNumber) => ({
        corpusId: candidate.goldCorpusIds[0]!,
        articleNumber: articleNumber.trim(),
      })),
    );
  }

  if (!registry) {
    throw new Error(
      `Multicorpus article registry is required to resolve gold articles for ${id}`,
    );
  }

  const reconciled = reconcileQuestionGoldArticles(
    {
      id,
      question: candidate.question,
      goldCorpusIds: candidate.goldCorpusIds,
      goldArticles: raw as unknown as GoldArticle[],
      referenceAnswer: candidate.referenceAnswer,
      questionType: candidate.questionType,
    },
    registry,
  );

  if (reconciled.unresolved) {
    throw new Error(
      `Unable to resolve gold articles for ${id}`,
    );
  }

  return reconciled.resolved;
}

export function assignQuestionIds(
  candidates: QuestionCandidateInput[],
  startIndex: number,
  registry?: MulticorpusCorpusArticleRegistry,
): LegalMulticorpusEvaluationQuestion[] {
  return candidates.map((candidate, offset) => {
    const id = `q${String(startIndex + offset).padStart(3, '0')}`;
    const goldArticles = normalizeCandidateGoldArticles(candidate, id, registry);
    const sourceArticles = candidate.sourceArticles
      ? normalizeCandidateGoldArticles(
          {
            ...candidate,
            goldCorpusIds:
              candidate.goldCorpusIds.length > 0
                ? candidate.goldCorpusIds
                : [...new Set(goldArticles.map((article) => article.corpusId))],
            goldArticles: candidate.sourceArticles as string[] | GoldArticle[],
          },
          `${id}-source`,
          registry,
        )
      : goldArticles;

    return {
      id,
      question: candidate.question.trim(),
      goldCorpusIds: [...candidate.goldCorpusIds],
      goldArticles,
      referenceAnswer: candidate.referenceAnswer.trim(),
      difficulty: candidate.difficulty,
      questionType: candidate.questionType,
      sourceArticles:
        sourceArticles.length > 0
          ? uniqueGoldArticles([...sourceArticles, ...goldArticles])
          : undefined,
    };
  });
}

export function buildDifficultyMix(
  count: number,
  targets: { easy: number; medium: number; hard: number },
): MulticorpusDifficulty[] {
  const mix: MulticorpusDifficulty[] = [];
  const total = targets.easy + targets.medium + targets.hard;
  const easyCount = Math.round((targets.easy / total) * count);
  const hardCount = Math.round((targets.hard / total) * count);
  const mediumCount = count - easyCount - hardCount;

  mix.push(...Array.from({ length: easyCount }, () => 'easy' as const));
  mix.push(...Array.from({ length: mediumCount }, () => 'medium' as const));
  mix.push(...Array.from({ length: hardCount }, () => 'hard' as const));

  while (mix.length < count) {
    mix.push('medium');
  }

  return mix.slice(0, count);
}
