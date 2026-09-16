import type {
  BucketCount,
  NumericSummary,
  ThresholdCount,
} from './chunk-token-stats.js';

export interface ChunkTokenRecord {
  chunkId: string;
  articleNumber: string;
  chunkIndex: number;
  chunkCount: number;
  charCount: number;
  storedCharCount: number | null;
  tokenCount: number;
  charsPerToken: number;
}

export interface CorpusTokenAnomaly {
  type: string;
  message: string;
  chunkId?: string;
}

export interface CorpusTokenAnalysis {
  corpusId: string;
  codeName: string;
  chunksPath: string;
  chunkCount: number;
  totalCharacters: number;
  totalTokens: number;
  globalCharsPerToken: number;
  characters: NumericSummary;
  tokens: NumericSummary;
  charsPerToken: NumericSummary;
  tokenBuckets: BucketCount[];
  thresholds: ThresholdCount[];
  largestChunks: ChunkTokenRecord[];
  anomalies: CorpusTokenAnomaly[];
  charCountMismatches: number;
  duplicateChunkIds: number;
}

export interface GlobalCorpusComparisonRow {
  corpusId: string;
  codeName: string;
  chunkCount: number;
  avgChars: number;
  p50Chars: number;
  p95Chars: number;
  maxChars: number;
  avgTokens: number;
  p50Tokens: number;
  p95Tokens: number;
  p99Tokens: number;
  maxTokens: number;
  avgCharsPerToken: number;
  globalCharsPerToken: number;
  gte1000Tokens: ThresholdCount;
  gte1500Tokens: ThresholdCount;
  gte2000Tokens: ThresholdCount;
  gte2500Tokens: ThresholdCount;
}

export interface ChunkTokenAnalysisReport {
  generatedAt: string;
  tokenizer: {
    name: string;
    encoding: string;
    model: string;
  };
  configuration: {
    targetChars: number;
    maxChars: number;
  };
  corpora: Record<string, CorpusTokenAnalysis>;
  global: {
    corpusCount: number;
    totalChunks: number;
    totalCharacters: number;
    totalTokens: number;
    averageTokensPerChunk: number;
    globalCharsPerToken: number;
    comparison: GlobalCorpusComparisonRow[];
  };
}
