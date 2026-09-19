import type { GoldArticle } from './gold-article.js';

export type { GoldArticle };

export type MulticorpusDifficulty = 'easy' | 'medium' | 'hard';

export type MulticorpusQuestionType =
  | 'single-corpus'
  | 'multi-corpus'
  | 'ambiguous'
  | 'out-of-scope';

export interface LegalMulticorpusEvaluationQuestion {
  id: string;
  question: string;
  goldCorpusIds: string[];
  goldArticles: GoldArticle[];
  referenceAnswer: string;
  difficulty: MulticorpusDifficulty;
  questionType: MulticorpusQuestionType;
  sourceArticles?: GoldArticle[];
}

export interface MulticorpusDatasetQuotas {
  singleCorpus: number;
  multiCorpus: number;
  ambiguous: number;
  outOfScope: number;
}

export const MULTICORPUS_DATASET_QUOTAS: MulticorpusDatasetQuotas = {
  singleCorpus: 362,
  multiCorpus: 63,
  ambiguous: 40,
  outOfScope: 35,
};

export const MULTICORPUS_SINGLE_CORPUS_QUOTAS: Record<string, number> = {
  'code-penal': 58,
  'code-civil': 60,
  'code-du-travail': 61,
  'code-du-commerce': 63,
  'code-monetaire-et-financier': 60,
  'code-de-la-consommation': 60,
};

export const MULTICORPUS_DIFFICULTY_TARGETS: Record<MulticorpusDifficulty, number> = {
  easy: 150,
  medium: 250,
  hard: 100,
};

export interface MulticorpusDuplicateGroup {
  questionIds: string[];
  reason: string;
  similarity: number;
}

export interface MulticorpusDatasetValidationSummary {
  questionCount: number;
  duplicateIds: string[];
  duplicateQuestions: string[];
  invalidStructure: string[];
  invalidQuestionTypeConsistency: string[];
  invalidGoldCorpusIds: string[];
  missingCorpusArticles: string[];
  invalidSourceArticles: string[];
  invalidDifficulty: string[];
  distributionIssues: string[];
  duplicateGroups: MulticorpusDuplicateGroup[];
  isValid: boolean;
}

export interface MulticorpusCorpusStats {
  corpusId: string;
  questionCount: number;
  distinctGoldArticles: number;
  averageGoldArticles: number;
}

export interface MulticorpusDatasetReport {
  totalQuestions: number;
  byQuestionType: Record<MulticorpusQuestionType, number>;
  byDifficulty: Record<MulticorpusDifficulty, number>;
  byCorpus: MulticorpusCorpusStats[];
  multiCorpusCombinations: Array<{ combination: string; count: number }>;
  articleCoverageByCorpus: Record<string, number>;
  overrepresentedArticles: Array<{ corpusId: string; articleNumber: string; count: number }>;
  duplicateGroups: MulticorpusDuplicateGroup[];
}
