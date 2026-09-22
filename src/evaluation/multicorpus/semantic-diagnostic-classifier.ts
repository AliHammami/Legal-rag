import type { GoldChunkStats } from './retrieval-diagnostic.js';
import { jaccardSimilarity } from './semantic-diagnostic-lexical.js';

export type SemanticCauseCategory =
  | 'query_formulation'
  | 'chunk_representation'
  | 'semantic_competition'
  | 'lexical_mismatch'
  | 'gold_intrinsically_difficult'
  | 'chunking_data'
  | 'indeterminate';

export interface SemanticClassificationInput {
  question: string;
  goldText: string;
  topCompetitorTexts: string[];
  goldChunkStats: GoldChunkStats | null;
  chunkingSignals: string[];
  neighborCompetitorsInTop10: number;
  sameCorpusCompetitorsInTop10: number;
  goldBm25Rank: number | null;
  questionTokenCount: number;
}

export interface SemanticClassificationResult {
  primary: SemanticCauseCategory;
  tags: SemanticCauseCategory[];
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
}

function pushTag(
  tags: Set<SemanticCauseCategory>,
  tag: SemanticCauseCategory,
): void {
  tags.add(tag);
}

export function classifySemanticAbsence(
  input: SemanticClassificationInput,
): SemanticClassificationResult {
  const tags = new Set<SemanticCauseCategory>();
  const jaccardQGold = jaccardSimilarity(input.question, input.goldText);
  const topJaccards = input.topCompetitorTexts.map((text) =>
    jaccardSimilarity(input.question, text),
  );
  const bestCompetitorJaccard =
    topJaccards.length > 0 ? Math.max(...topJaccards) : 0;

  if (input.neighborCompetitorsInTop10 >= 2) {
    pushTag(tags, 'semantic_competition');
  }
  if (
    bestCompetitorJaccard >= jaccardQGold + 0.08 &&
    jaccardQGold < 0.12
  ) {
    pushTag(tags, 'lexical_mismatch');
  }
  if (
    input.questionTokenCount < 10 ||
    (jaccardQGold < 0.03 && input.question.length > 40)
  ) {
    pushTag(tags, 'query_formulation');
  }
  if (input.goldChunkStats) {
    if (
      input.goldChunkStats.overTargetSize ||
      input.goldChunkStats.multiChunk ||
      input.goldChunkStats.totalChars > 2500
    ) {
      pushTag(tags, 'chunk_representation');
    }
    if (
      input.chunkingSignals.includes('chunk-at-max-size') ||
      input.chunkingSignals.includes('information-split-across-chunks')
    ) {
      pushTag(tags, 'chunking_data');
    }
  }
  if (
    jaccardQGold < 0.05 &&
    (input.goldBm25Rank === null || input.goldBm25Rank > 50) &&
    input.neighborCompetitorsInTop10 === 0
  ) {
    pushTag(tags, 'gold_intrinsically_difficult');
  }

  if (tags.size === 0) {
    pushTag(tags, 'indeterminate');
  }

  const priority: SemanticCauseCategory[] = [
    'semantic_competition',
    'lexical_mismatch',
    'query_formulation',
    'chunk_representation',
    'chunking_data',
    'gold_intrinsically_difficult',
    'indeterminate',
  ];
  const primary =
    priority.find((category) => tags.has(category)) ?? 'indeterminate';

  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (primary === 'semantic_competition' && input.neighborCompetitorsInTop10 >= 3) {
    confidence = 'high';
  } else if (primary === 'indeterminate' || tags.size > 3) {
    confidence = 'low';
  } else if (
    primary === 'lexical_mismatch' &&
    bestCompetitorJaccard - jaccardQGold >= 0.12
  ) {
    confidence = 'high';
  }

  const rationaleParts = [
    `jaccard(question,gold)=${jaccardQGold.toFixed(3)}`,
    `bestCompetitorJaccard=${bestCompetitorJaccard.toFixed(3)}`,
    `neighborsTop10=${input.neighborCompetitorsInTop10}`,
    input.goldBm25Rank !== null
      ? `bm25Rank=${input.goldBm25Rank}`
      : 'bm25Rank>50',
  ];

  return {
    primary,
    tags: [...tags],
    confidence,
    rationale: rationaleParts.join('; '),
  };
}

export const CAUSE_LABELS: Record<SemanticCauseCategory, string> = {
  query_formulation: 'Query / formulation',
  chunk_representation: 'Chunk / representation',
  semantic_competition: 'Semantic competition',
  lexical_mismatch: 'Lexical mismatch',
  gold_intrinsically_difficult: 'Gold intrinsiquement difficile',
  chunking_data: 'Chunking / donnees',
  indeterminate: 'Indetermine',
};
