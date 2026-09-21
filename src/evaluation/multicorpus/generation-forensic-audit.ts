import {
  goldArticleKey,
  goldArticlesMatch,
  goldCorpusIdsFromArticles,
  type GoldArticle,
} from '../gold-article.js';
import { JUDGE_PASS_SCORE_THRESHOLD } from '../report-metrics.js';
import type { LegalMulticorpusEvaluationQuestion } from '../multicorpus-dataset.types.js';
import type { E2EQuestionResult, E2EVariantResult } from './types.js';

export type GenerationForensicCategory = 'A' | 'B' | 'C' | 'D' | 'E';

export type GenerationForensicSubCause =
  | 'B1'
  | 'B2'
  | 'B3'
  | 'B4'
  | 'B5'
  | 'B6'
  | 'B7';

export type GoldContextCoverage = 'none' | 'partial' | 'full';

export interface GenerationForensicRecord {
  questionId: string;
  question: string;
  questionType: LegalMulticorpusEvaluationQuestion['questionType'];
  difficulty: LegalMulticorpusEvaluationQuestion['difficulty'];
  referenceAnswer: string;
  goldArticles: GoldArticle[];
  goldCorpusIds: string[];
  pipelineFailureStage: 'generation';
  variantAnalyzed: 'routing';
  generatedAnswer: string;
  contextSources: GoldArticle[];
  contextSourceCount: number;
  goldArticlesInContext: GoldArticle[];
  goldArticlesMissingFromContext: GoldArticle[];
  goldCorpusInContext: string[];
  goldCorpusMissingFromContext: string[];
  judge: NonNullable<E2EVariantResult['judge']>;
  sourceJudge: E2EVariantResult['sourceJudge'];
  profiling: E2EVariantResult['profiling'];
  goldContextCoverage: GoldContextCoverage;
  forensicCategory: GenerationForensicCategory;
  forensicSubCause?: GenerationForensicSubCause;
  forensicRationale: string;
  signals: {
    allGoldArticlesInContext: boolean;
    allGoldCorporaRepresented: boolean;
    judgeIndicatesInsufficientContext: boolean;
    modelDeclinesDueToContext: boolean;
    citationOrSourceIssue: boolean;
    incorrectAbstentionWhenAnswerExpected: boolean;
  };
}

const INSUFFICIENT_CONTEXT_PATTERN =
  /contexte (fourni )?ne (contient|reproduit|pr[e?]cise)|ne contient pas|extrait.*ne|sources (fournies )?ne|impossible.*(contexte|sources fournies|r[e?]pondre.*contexte)|ind[e?]terminable.*contexte|absence (de l['']|d[''])|n['']?y figure pas|n['']?est pas fourni|ne permet pas de r[e?]pondre|seule base|seul contexte/i;

const MODEL_DECLINE_PATTERN =
  /impossible de (d[e?]terminer|r[e?]pondre|identifier)|ne permet pas|n['']?est pas possible/i;

const CITATION_SOURCE_PATTERN =
  /citation|source \[|attribue|mauvaise r[e?]f[e?]rence|m[e?]lange|confond|attribution|sources? (ne )?couvr/i;

const ABSTENTION_PATTERN =
  /abstention|s['']?abstient|refuse de r[e?]pondre|abstient de r[e?]pondre|abstient/i;

function goldInSources(
  gold: GoldArticle[],
  sources: GoldArticle[],
): { present: GoldArticle[]; missing: GoldArticle[] } {
  const present: GoldArticle[] = [];
  const missing: GoldArticle[] = [];
  for (const article of gold) {
    if (sources.some((source) => goldArticlesMatch(article, source))) {
      present.push(article);
    } else {
      missing.push(article);
    }
  }
  return { present, missing };
}

function corporaFromSources(sources: GoldArticle[]): string[] {
  return [...new Set(sources.map((source) => source.corpusId))].sort();
}

function missingGoldCorpora(
  goldCorpusIds: string[],
  sources: GoldArticle[],
): string[] {
  const inContext = new Set(sources.map((source) => source.corpusId));
  return goldCorpusIds.filter((corpusId) => !inContext.has(corpusId));
}

function judgeFailedAxis(judge: NonNullable<E2EVariantResult['judge']>): string[] {
  const failed: string[] = [];
  if (judge.correctness < JUDGE_PASS_SCORE_THRESHOLD) failed.push('correctness');
  if (judge.completeness < JUDGE_PASS_SCORE_THRESHOLD) failed.push('completeness');
  if (judge.groundedness < JUDGE_PASS_SCORE_THRESHOLD) failed.push('groundedness');
  return failed;
}

function inferSubCause(
  record: Omit<GenerationForensicRecord, 'forensicSubCause'>,
): GenerationForensicSubCause | undefined {
  if (record.forensicCategory !== 'B') {
    return undefined;
  }

  const text = [
    record.judge.explanation,
    record.sourceJudge?.explanation ?? '',
    record.generatedAnswer,
  ].join(' ');

  if (record.judge.groundedness < JUDGE_PASS_SCORE_THRESHOLD) {
    return 'B5';
  }
  if (CITATION_SOURCE_PATTERN.test(text) || (record.sourceJudge?.sourceRelevance ?? 4) < 3) {
    return 'B6';
  }
  if (ABSTENTION_PATTERN.test(record.judge.explanation)) {
    return 'B3';
  }
  if (/interpr[e?]t|confond|attribue|mauvaise lecture|reformule.*impr[e?]cis/i.test(text)) {
    return 'B1';
  }
  if (/omitted|omet|partielle|incompl[e?]te|ne mentionne pas|n['']identifie pas|ne donne pas/i.test(text)) {
    return 'B3';
  }
  if (/juridique|infraction|peine|conditions|d[e?]finition/i.test(record.judge.explanation)) {
    return 'B4';
  }
  if (/ambigu|contradict/i.test(text)) {
    return 'B2';
  }
  return 'B7';
}

export function classifyGenerationForensic(input: {
  question: LegalMulticorpusEvaluationQuestion;
  e2e: E2EQuestionResult;
}): GenerationForensicRecord {
  const variant = input.e2e.routing;
  const judge = variant.judge!;
  const combinedText = [
    judge.explanation,
    variant.sourceJudge?.explanation ?? '',
    variant.answer,
  ].join('\n');

  const { present, missing } = goldInSources(
    input.question.goldArticles,
    variant.sources,
  );
  const goldCorpusIds = goldCorpusIdsFromArticles(input.question.goldArticles);
  const missingCorpora = missingGoldCorpora(goldCorpusIds, variant.sources);
  const allGoldInContext = missing.length === 0;
  const allCorporaRepresented = missingCorpora.length === 0;

  const judgeIndicatesInsufficientContext =
    INSUFFICIENT_CONTEXT_PATTERN.test(combinedText);
  const modelDeclinesDueToContext = MODEL_DECLINE_PATTERN.test(variant.answer);
  const citationOrSourceIssue =
    CITATION_SOURCE_PATTERN.test(judge.explanation) ||
    (variant.sourceJudge !== undefined &&
      (variant.sourceJudge.sourceRelevance < JUDGE_PASS_SCORE_THRESHOLD ||
        (variant.sourceJudge.sourceCoverage < JUDGE_PASS_SCORE_THRESHOLD &&
          allGoldInContext)));
  const incorrectAbstentionWhenAnswerExpected =
    ABSTENTION_PATTERN.test(judge.explanation) &&
    modelDeclinesDueToContext;

  const goldContextCoverage: GoldContextCoverage =
    present.length === 0
      ? 'none'
      : present.length === input.question.goldArticles.length
        ? 'full'
        : 'partial';

  let forensicCategory: GenerationForensicCategory;
  let forensicRationale: string;

  if (!allGoldInContext || !allCorporaRepresented) {
    forensicCategory = 'A';
    if (present.length === 0) {
      forensicRationale =
        'Aucun article gold present dans le contexte final (sources citees).';
    } else {
      forensicRationale = `Couverture gold partielle (${present.length}/${input.question.goldArticles.length}); manquants: ${missing.map(goldArticleKey).join(', ')}.`;
    }
    if (!allCorporaRepresented && missingCorpora.length > 0) {
      forensicRationale += ` Corpus gold absent(s): ${missingCorpora.join(', ')}.`;
    }
  } else if (
    citationOrSourceIssue &&
    judge.groundedness >= JUDGE_PASS_SCORE_THRESHOLD &&
    /source|citation|cite|r[e?]f[e?]rence|attribu/i.test(judge.explanation) &&
    judge.correctness >= JUDGE_PASS_SCORE_THRESHOLD
  ) {
    forensicCategory = 'C';
    forensicRationale =
      'Articles gold presents; le juge signale surtout un probleme de citation ou d attribution des sources.';
  } else {
    forensicCategory = 'B';
    forensicRationale =
      'Tous les articles et corpus gold sont presents dans le contexte final; l echec judge est imputable a la generation.';
  }

  const base: Omit<GenerationForensicRecord, 'forensicSubCause'> = {
    questionId: input.question.id,
    question: input.question.question,
    questionType: input.question.questionType,
    difficulty: input.question.difficulty,
    referenceAnswer: input.question.referenceAnswer,
    goldArticles: input.question.goldArticles,
    goldCorpusIds,
    pipelineFailureStage: 'generation',
    variantAnalyzed: 'routing',
    generatedAnswer: variant.answer,
    contextSources: variant.sources,
    contextSourceCount: variant.sources.length,
    goldArticlesInContext: present,
    goldArticlesMissingFromContext: missing,
    goldCorpusInContext: corporaFromSources(variant.sources),
    goldCorpusMissingFromContext: missingCorpora,
    judge,
    sourceJudge: variant.sourceJudge,
    profiling: variant.profiling,
    goldContextCoverage,
    forensicCategory,
    forensicRationale,
    signals: {
      allGoldArticlesInContext: allGoldInContext,
      allGoldCorporaRepresented: allCorporaRepresented,
      judgeIndicatesInsufficientContext,
      modelDeclinesDueToContext,
      citationOrSourceIssue,
      incorrectAbstentionWhenAnswerExpected,
    },
  };

  return {
    ...base,
    forensicSubCause: inferSubCause(base),
  };
}

export function isPipelineGenerationFailure(e2e: E2EQuestionResult): boolean {
  return e2e.failureStage === 'generation';
}

export function summarizeForensicCategories(
  records: GenerationForensicRecord[],
): Record<GenerationForensicCategory, number> {
  const counts: Record<GenerationForensicCategory, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
  };
  for (const record of records) {
    counts[record.forensicCategory] += 1;
  }
  return counts;
}

export function summarizeSubCauses(
  records: GenerationForensicRecord[],
): Partial<Record<GenerationForensicSubCause, number>> {
  const counts: Partial<Record<GenerationForensicSubCause, number>> = {};
  for (const record of records) {
    if (record.forensicSubCause) {
      counts[record.forensicSubCause] =
        (counts[record.forensicSubCause] ?? 0) + 1;
    }
  }
  return counts;
}

export function failedJudgeAxesLabel(
  judge: NonNullable<E2EVariantResult['judge']>,
): string {
  return judgeFailedAxis(judge).join(', ') || 'none';
}
