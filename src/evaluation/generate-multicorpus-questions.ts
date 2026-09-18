import type { OpenAIService } from '../openai/openai.service.js';
import { DEFAULT_MULTICORPUS_GENERATION_MODEL } from './constants.js';
import type { CorpusArticleRecord } from './load-corpus-article-index.js';
import type {
  LegalMulticorpusEvaluationQuestion,
  MulticorpusDifficulty,
  MulticorpusQuestionType,
} from './multicorpus-dataset.types.js';
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

const GENERATED_QUESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'question',
          'goldCorpusIds',
          'goldArticles',
          'referenceAnswer',
          'difficulty',
          'questionType',
          'sourceArticles',
        ],
        properties: {
          question: { type: 'string' },
          goldCorpusIds: {
            type: 'array',
            items: { type: 'string' },
          },
          goldArticles: {
            type: 'array',
            items: { type: 'string' },
          },
          referenceAnswer: { type: 'string' },
          difficulty: {
            type: 'string',
            enum: ['easy', 'medium', 'hard'],
          },
          questionType: {
            type: 'string',
            enum: ['single-corpus', 'multi-corpus'],
          },
          sourceArticles: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

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

  return `Tu construis des questions d'?valuation pour un syst?me RAG juridique fran?ais.

R?GLES ABSOLUES:
- Ne jamais inventer un num?ro d'article, une disposition ou une r?gle absente des textes fournis.
- Chaque question doit ?tre answerable uniquement ? partir des articles fournis ci-dessous.
- goldArticles doit lister uniquement les articles r?ellement n?cessaires pour r?pondre.
- goldCorpusIds doit ?tre ["${corpusId}"] pour chaque question.
- questionType doit ?tre "single-corpus".
- referenceAnswer: concise, correcte, d?riv?e uniquement des textes fournis.
- Varier les formulations (cas pratiques, comparaisons, conditions, effets, distinctions).
- Ne pas produire plusieurs variantes lexicales d'une m?me question.
- sourceArticles doit contenir au minimum tous les goldArticles.

ARTICLES FOURNIS:
${articleBlocks}

G?n?re exactement ${articles.length} questions, une par article fourni.
R?partition de difficult? demand?e: ${difficultyMix.join(', ')}.`;
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

  return `Tu construis des questions d'?valuation multi-corpus pour un syst?me RAG juridique fran?ais.

R?GLES ABSOLUES:
- Ne jamais inventer un article ou une r?gle absente des textes fournis.
- Chaque question doit r?ellement n?cessiter des informations de TOUS les corpus list?s dans le sc?nario.
- goldCorpusIds doit contenir au moins 2 corpus distincts et correspondre aux corpus r?ellement n?cessaires.
- goldArticles doit lister uniquement les articles r?ellement n?cessaires.
- questionType = "multi-corpus".
- referenceAnswer d?riv?e uniquement des textes fournis.
- Ne pas ajouter artificiellement un second corpus si la question est essentiellement mono-corpus.

SC?NARIOS:
${bundleBlocks}

G?n?re exactement ${bundles.length} questions, une par sc?nario.
R?partition de difficult? demand?e: ${difficultyMix.join(', ')}.`;
}

export async function generateSingleCorpusQuestions(
  openAIService: OpenAIService,
  corpusId: string,
  articles: CorpusArticleRecord[],
  difficultyMix: MulticorpusDifficulty[],
  model = DEFAULT_MULTICORPUS_GENERATION_MODEL,
): Promise<GeneratedQuestionCandidate[]> {
  const response = await openAIService.createStructuredChatCompletion<{
    questions: GeneratedQuestionCandidate[];
  }>({
    model,
    schemaName: 'multicorpus_single_corpus_questions',
    schema: GENERATED_QUESTION_SCHEMA,
    messages: [
      {
        role: 'system',
        content:
          'Tu es un juriste expert qui construit des datasets d ?valuation RAG strictement ancr?s dans les textes fournis.',
      },
      {
        role: 'user',
        content: buildSingleCorpusPrompt(corpusId, articles, difficultyMix),
      },
    ],
  });

  return response.questions ?? [];
}

export async function generateMultiCorpusQuestions(
  openAIService: OpenAIService,
  bundles: MultiCorpusArticleBundle[][],
  difficultyMix: MulticorpusDifficulty[],
  model = DEFAULT_MULTICORPUS_GENERATION_MODEL,
): Promise<GeneratedQuestionCandidate[]> {
  const response = await openAIService.createStructuredChatCompletion<{
    questions: GeneratedQuestionCandidate[];
  }>({
    model,
    schemaName: 'multicorpus_multi_corpus_questions',
    schema: GENERATED_QUESTION_SCHEMA,
    messages: [
      {
        role: 'system',
        content:
          'Tu es un juriste expert qui construit des datasets d ?valuation RAG multi-corpus strictement ancr?s dans les textes fournis.',
      },
      {
        role: 'user',
        content: buildMultiCorpusPrompt(bundles, difficultyMix),
      },
    ],
  });

  return response.questions ?? [];
}

export function assignQuestionIds(
  candidates: GeneratedQuestionCandidate[],
  startIndex: number,
): LegalMulticorpusEvaluationQuestion[] {
  return candidates.map((candidate, offset) => ({
    id: `q${String(startIndex + offset).padStart(3, '0')}`,
    question: candidate.question.trim(),
    goldCorpusIds: [...candidate.goldCorpusIds],
    goldArticles: [...candidate.goldArticles],
    referenceAnswer: candidate.referenceAnswer.trim(),
    difficulty: candidate.difficulty,
    questionType: candidate.questionType,
    sourceArticles: candidate.sourceArticles
      ? [...candidate.sourceArticles]
      : [...candidate.goldArticles],
  }));
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
