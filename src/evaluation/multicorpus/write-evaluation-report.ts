import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  MULTICORPUS_LATEST_JSON_PATH,
  MULTICORPUS_LATEST_MD_PATH,
} from './evaluation-config.js';
import type { MulticorpusEvaluationReports } from './types.js';

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function num(value: number): string {
  return value.toFixed(3);
}

export function formatMulticorpusEvaluationMarkdown(
  report: MulticorpusEvaluationReports,
): string {
  const lines: string[] = [
    '# Multi-corpus RAG Evaluation',
    '',
    `Dataset: ${report.metadata.questionCount} questions`,
    `Run: ${report.metadata.timestamp}`,
    `Evaluator: ${report.metadata.evaluatorVersion}`,
    '',
    '## Model configuration',
    '',
    `- Embedding: ${report.metadata.modelConfiguration.embeddingModel}`,
    `- Reranker: ${report.metadata.modelConfiguration.rerankerModel}`,
    `- Generation: ${report.metadata.modelConfiguration.generationModel}`,
    `- Routing: ${report.metadata.modelConfiguration.routingModel}`,
    `- Judge: ${report.metadata.modelConfiguration.judgeModel ?? 'n/a'}`,
    `- retrievalTopK: ${report.metadata.modelConfiguration.retrievalTopK}`,
    `- rerankTopK: ${report.metadata.modelConfiguration.rerankTopK}`,
    `- relativeScoreThreshold: ${report.metadata.modelConfiguration.relativeScoreThreshold}`,
    `- evaluationConcurrency: ${report.metadata.evaluationConcurrency}`,
    `- jinaConcurrency: ${report.metadata.jinaConcurrency}`,
    '',
  ];

  if (report.routing) {
    lines.push('## Routing', '');
    lines.push(`- Exact match: ${pct(report.routing.summary.exactMatchRate)}`);
    lines.push(`- Precision: ${num(report.routing.summary.precision)}`);
    lines.push(`- Recall: ${num(report.routing.summary.recall)}`);
    lines.push(`- F1: ${num(report.routing.summary.f1)}`);
    lines.push(
      `- Ambiguous ? []: ${pct(report.routing.summary.ambiguousEmptyPredictionRate)}`,
    );
    lines.push(
      `- Out-of-scope ? []: ${pct(report.routing.summary.outOfScopeEmptyPredictionRate)}`,
    );
    lines.push('');
  }

  if (report.retrieval) {
    lines.push('## Retrieval', '');
    lines.push('');
    lines.push('| Mode | Recall@5 | Recall@10 | Recall@20 | MRR |');
    lines.push('| --- | ---: | ---: | ---: | ---: |');
    lines.push(
      `| Global baseline | ${pct(report.retrieval.summary.global.recallAt5)} | ${pct(report.retrieval.summary.global.recallAt10)} | ${pct(report.retrieval.summary.global.recallAt20)} | ${num(report.retrieval.summary.global.mrr)} |`,
    );
    lines.push(
      `| Routing + retrieval | ${pct(report.retrieval.summary.routed.recallAt5)} | ${pct(report.retrieval.summary.routed.recallAt10)} | ${pct(report.retrieval.summary.routed.recallAt20)} | ${num(report.retrieval.summary.routed.mrr)} |`,
    );
    lines.push('');
  }

  if (report.reranking) {
    lines.push('## Reranking', '');
    lines.push('');
    lines.push('| Mode | Recall@5 | MRR |');
    lines.push('| --- | ---: | ---: |');
    lines.push(
      `| Vector Top5 | ${pct(report.reranking.summary.vectorTop5.recallAt5)} | ${num(report.reranking.summary.vectorTop5.mrr)} |`,
    );
    lines.push(
      `| Vector + Jina | ${pct(report.reranking.summary.jinaTop5.recallAt5)} | ${num(report.reranking.summary.jinaTop5.mrr)} |`,
    );
    lines.push('');
    lines.push(
      `- Improved: ${report.reranking.summary.improved} | Degraded: ${report.reranking.summary.degraded} | Unchanged: ${report.reranking.summary.unchanged}`,
    );
    lines.push('');
  }

  if (report.e2e) {
    lines.push('## E2E', '');
    lines.push('');
    lines.push('| Variant | Correctness | Completeness | Groundedness | Abstention | Source rel. | Source cov. |');
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const [label, metrics] of Object.entries(report.e2e.summary)) {
      lines.push(
        `| ${label} | ${num(metrics.correctness)} | ${num(metrics.completeness)} | ${num(metrics.groundedness)} | ${pct(metrics.abstention)} | ${num(metrics.sourceRelevance)} | ${num(metrics.sourceCoverage)} |`,
      );
    }
    lines.push('');
    lines.push(
      `- Jina fallback: ${report.e2e.rerankFallbacks} / ${report.e2e.rerankPipelineRuns}`,
    );
    lines.push('');
    lines.push('### Latency (routing variant, ms)');
    lines.push('');
    for (const [stage, stats] of Object.entries(report.e2e.latency)) {
      lines.push(
        `- ${stage}: avg ${Math.round(stats.average)} | p50 ${Math.round(stats.p50)} | p95 ${Math.round(stats.p95)}`,
      );
    }
    lines.push('');
  }

  if (report.errors) {
    lines.push('## Error analysis', '');
    for (const [stage, count] of Object.entries(report.errors.byStage)) {
      lines.push(`- ${stage}: ${count}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export async function writeMulticorpusEvaluationReports(
  runDir: string,
  report: MulticorpusEvaluationReports,
): Promise<void> {
  await mkdir(runDir, { recursive: true });

  if (report.routing) {
    await writeFile(
      join(runDir, 'routing.json'),
      `${JSON.stringify(report.routing, null, 2)}\n`,
      'utf-8',
    );
  }
  if (report.retrieval) {
    await writeFile(
      join(runDir, 'retrieval.json'),
      `${JSON.stringify(report.retrieval, null, 2)}\n`,
      'utf-8',
    );
  }
  if (report.reranking) {
    await writeFile(
      join(runDir, 'reranking.json'),
      `${JSON.stringify(report.reranking, null, 2)}\n`,
      'utf-8',
    );
  }
  if (report.e2e) {
    await writeFile(
      join(runDir, 'e2e.json'),
      `${JSON.stringify(report.e2e, null, 2)}\n`,
      'utf-8',
    );
  }

  const markdown = formatMulticorpusEvaluationMarkdown(report);
  await writeFile(join(runDir, 'report.md'), `${markdown}\n`, 'utf-8');
  await writeFile(
    join(runDir, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf-8',
  );

  await mkdir(dirname(MULTICORPUS_LATEST_MD_PATH), { recursive: true });
  await writeFile(MULTICORPUS_LATEST_MD_PATH, `${markdown}\n`, 'utf-8');
  await writeFile(
    MULTICORPUS_LATEST_JSON_PATH,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf-8',
  );
}
