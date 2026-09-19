import { access } from 'node:fs/promises';
import { basename, isAbsolute, join, resolve } from 'node:path';

import { DEFAULT_RELATIVE_SCORE_THRESHOLD } from '../../generation/constants.js';
import { DEFAULT_EMBEDDING_MODEL } from '../../embeddings/constants.js';
import {
  DEFAULT_RERANK_TOP_K,
  DEFAULT_RETRIEVAL_TOP_K,
} from '../../reranking/constants.js';
import { DEFAULT_ROUTING_MODEL } from '../../routing/constants.js';
import {
  DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH,
} from '../constants.js';
import { DEFAULT_RAG_EVALUATION_JUDGE_MODEL } from '../e2e-judge.constants.js';
import type { MulticorpusModelConfiguration } from './types.js';

export const MULTICORPUS_EVALUATOR_VERSION = '1.0.0';
/** Jina API allows 2 concurrent requests; default to 1 for headroom during long benchmarks. */
export const DEFAULT_JINA_CONCURRENCY = 1;
export const DEFAULT_JINA_MAX_RETRIES = 8;
export const DEFAULT_JINA_RETRY_BASE_DELAY_MS = 1000;
/** Minimum spacing between consecutive Jina calls in one benchmark run. */
export const DEFAULT_JINA_MIN_INTERVAL_MS = 5000;
/** Shared cooldown when Jina returns RATE_TOKEN_LIMIT_EXCEEDED. */
export const DEFAULT_JINA_TOKEN_LIMIT_COOLDOWN_MS = 90_000;
/** Shared cooldown when Jina returns RATE_CONCURRENCY_LIMIT_EXCEEDED. */
export const DEFAULT_JINA_CONCURRENCY_LIMIT_COOLDOWN_MS = 5000;
export const MULTICORPUS_DATASET_VERSION = 'legal-multicorpus-v2-gold-articles';

export const DEFAULT_MULTICORPUS_RESULTS_DIR = 'reports/evaluation/runs';
export const MULTICORPUS_LATEST_MD_PATH = 'reports/evaluation/multicorpus-latest.md';
export const MULTICORPUS_LATEST_JSON_PATH = 'reports/evaluation/multicorpus-latest.json';

export interface MulticorpusEvaluationCliOptions {
  modes: Set<'routing' | 'retrieval' | 'reranking' | 'e2e'>;
  concurrency: number;
  jinaConcurrency: number;
  limit?: number;
  questionId?: string;
  force: boolean;
  datasetPath: string;
  resultsDir: string;
  /** Run id or path under `--results-dir` to reuse an existing run folder and its cache. */
  resume?: string;
}

export function parseMulticorpusEvaluationCliOptions(
  argv: string[],
): MulticorpusEvaluationCliOptions {
  const modes = new Set<'routing' | 'retrieval' | 'reranking' | 'e2e'>();
  let concurrency = 3;
  let jinaConcurrency = DEFAULT_JINA_CONCURRENCY;
  let limit: number | undefined;
  let questionId: string | undefined;
  let force = false;
  let datasetPath = DEFAULT_MULTICORPUS_EVALUATION_DATASET_PATH;
  let resultsDir = DEFAULT_MULTICORPUS_RESULTS_DIR;
  let resume: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--routing') modes.add('routing');
    else if (arg === '--retrieval') modes.add('retrieval');
    else if (arg === '--reranking') modes.add('reranking');
    else if (arg === '--e2e') modes.add('e2e');
    else if (arg === '--all') {
      modes.add('routing');
      modes.add('retrieval');
      modes.add('reranking');
      modes.add('e2e');
    } else if (arg === '--force') force = true;
    else if (arg === '--concurrency' && argv[i + 1]) concurrency = Number(argv[++i]);
    else if (arg === '--jina-concurrency' && argv[i + 1]) {
      jinaConcurrency = Number(argv[++i]);
    }
    else if (arg === '--limit' && argv[i + 1]) limit = Number(argv[++i]);
    else if (arg === '--question-id' && argv[i + 1]) questionId = argv[++i];
    else if (arg === '--dataset' && argv[i + 1]) datasetPath = argv[++i];
    else if (arg === '--results-dir' && argv[i + 1]) resultsDir = argv[++i];
    else if (arg === '--resume' && argv[i + 1]) resume = argv[++i];
  }

  if (modes.size === 0) {
    throw new Error(
      'Specify at least one mode: --routing, --retrieval, --reranking, --e2e, or --all',
    );
  }

  return {
    modes,
    concurrency: Math.max(1, concurrency),
    jinaConcurrency: Math.max(1, jinaConcurrency),
    limit,
    questionId,
    force,
    datasetPath,
    resultsDir,
    resume,
  };
}

export async function resolveMulticorpusRunDirectory(options: {
  resultsDir: string;
  resume?: string;
}): Promise<{ runDir: string; timestamp: string; resumed: boolean }> {
  if (!options.resume) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
      runDir: join(options.resultsDir, timestamp),
      timestamp,
      resumed: false,
    };
  }

  const runDir = isAbsolute(options.resume)
    ? options.resume
    : options.resume.includes('/')
      ? resolve(options.resume)
      : join(options.resultsDir, options.resume);

  try {
    await access(runDir);
  } catch {
    throw new Error(`Resume run directory not found: ${runDir}`);
  }

  return {
    runDir,
    timestamp: basename(runDir),
    resumed: true,
  };
}

export function buildDefaultModelConfiguration(
  overrides: Partial<MulticorpusModelConfiguration> = {},
): MulticorpusModelConfiguration {
  return {
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    rerankerModel: 'jina-reranker-v3.5',
    generationModel: process.env.OPENAI_MODEL ?? 'gpt-5.6-luna',
    routingModel: process.env.OPENAI_ROUTING_MODEL ?? DEFAULT_ROUTING_MODEL,
    judgeModel: process.env.RAG_EVALUATION_JUDGE_MODEL ?? DEFAULT_RAG_EVALUATION_JUDGE_MODEL,
    retrievalTopK: DEFAULT_RETRIEVAL_TOP_K,
    rerankTopK: DEFAULT_RERANK_TOP_K,
    relativeScoreThreshold: DEFAULT_RELATIVE_SCORE_THRESHOLD,
    routingEnabled: true,
    ...overrides,
  };
}
