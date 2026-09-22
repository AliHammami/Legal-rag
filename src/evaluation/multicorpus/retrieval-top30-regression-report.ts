import { goldArticlesMatch } from '../gold-article.js';
import type { RetrievalTop30SmokeQuestionResult } from './retrieval-top30-smoke-pipeline.js';
import type { E2EQuestionResult } from './types.js';

export type RegressionDecision = 'NO_REGRESSION' | 'REGRESSION';

export interface RegressionBaselineSnapshot {
  source: 'e2e500_routing' | 'smoke_top30';
  correctness: number;
  completeness: number;
  groundedness: number;
  sourceRelevance: number;
  sourceCoverage: number;
  abstentionCorrect: boolean;
  finalContextGoldCount?: number;
}

export interface RegressionFinding {
  questionId: string;
  kind:
    | 'correctness_drop'
    | 'groundedness_drop'
    | 'abstention_regression'
    | 'topk30_gain_lost'
    | 'hallucination_signal'
    | 'citation_loss';
  detail: string;
}

const TOPK30_GAINS = new Set(['q334', 'q367', 'q378']);

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function aggregateRegressionMetrics(
  results: RetrievalTop30SmokeQuestionResult[],
): {
  retrievalGoldRecall: number;
  finalContextGoldRecall: number;
  finalContextFullCoverageRate: number;
  multiCorpusCorpusCoverage: number;
  correctness: number;
  completeness: number;
  groundedness: number;
  sourceRelevance: number;
  sourceCoverage: number;
  abstentionCorrectRate: number;
} {
  const goldTotal = results.reduce(
    (sum, result) => sum + result.goldArticles.length,
    0,
  );
  const retrievalAt30 = results.reduce(
    (sum, result) =>
      sum +
      result.goldArticles.filter((gold) =>
        result.retrieval.some(
          (row) => row.rank <= 30 && goldArticlesMatch(gold, row),
        ),
      ).length,
    0,
  );
  const finalHits = results.reduce(
    (sum, result) => sum + result.metrics.finalContextGoldHits.length,
    0,
  );

  const multiResults = results.filter(
    (result) => result.questionType === 'multi-corpus',
  );
  const multiCorpusCoverage = average(
    multiResults.map((result) => result.metrics.retrievalCorpusCoverageAt30),
  );

  return {
    retrievalGoldRecall: goldTotal ? retrievalAt30 / goldTotal : 0,
    finalContextGoldRecall: goldTotal ? finalHits / goldTotal : 0,
    finalContextFullCoverageRate: average(
      results.map((result) =>
        result.metrics.finalContextFullCoverage ? 1 : 0,
      ),
    ),
    multiCorpusCorpusCoverage: multiCorpusCoverage,
    correctness: average(results.map((result) => result.judge.correctness)),
    completeness: average(results.map((result) => result.judge.completeness)),
    groundedness: average(results.map((result) => result.judge.groundedness)),
    sourceRelevance: average(
      results.map((result) => result.sourceJudge.sourceRelevance),
    ),
    sourceCoverage: average(
      results.map((result) => result.sourceJudge.sourceCoverage),
    ),
    abstentionCorrectRate: average(
      results.map((result) => (result.judge.abstentionCorrect ? 1 : 0)),
    ),
  };
}

export function detectRegressionFindings(input: {
  results: RetrievalTop30SmokeQuestionResult[];
  baselineByQuestion: Map<string, RegressionBaselineSnapshot>;
  smokeTop30ByQuestion: Map<string, RetrievalTop30SmokeQuestionResult>;
}): RegressionFinding[] {
  const findings: RegressionFinding[] = [];

  for (const result of input.results) {
    const baseline = input.baselineByQuestion.get(result.questionId);
    const expectedAbstention =
      result.questionType === 'ambiguous' ||
      result.questionType === 'out-of-scope' ||
      result.routing.abstain;

    if (expectedAbstention) {
      if (result.routing.abstain && result.retrieval.length > 0) {
        findings.push({
          questionId: result.questionId,
          kind: 'abstention_regression',
          detail:
            'Router abstention mais retrieval execute (regression topK ou pipeline).',
        });
      }
      const baselineAbstOk = baseline?.abstentionCorrect ?? false;
      if (baselineAbstOk && !result.judge.abstentionCorrect) {
        findings.push({
          questionId: result.questionId,
          kind: 'abstention_regression',
          detail:
            'Abstention correcte @20 reference, incorrecte sur mini E2E @30.',
        });
      }
      continue;
    }

    if (baseline) {
      if (
        baseline.correctness >= 3.5 &&
        result.judge.correctness <= baseline.correctness - 1.5
      ) {
        findings.push({
          questionId: result.questionId,
          kind: 'correctness_drop',
          detail: `Correctness ${baseline.correctness.toFixed(1)} -> ${result.judge.correctness.toFixed(1)}.`,
        });
      }
      if (
        baseline.groundedness >= 3.5 &&
        result.judge.groundedness <= baseline.groundedness - 1 &&
        result.judge.correctness <= baseline.correctness - 1
      ) {
        findings.push({
          questionId: result.questionId,
          kind: 'groundedness_drop',
          detail: `Groundedness ${baseline.groundedness.toFixed(1)} -> ${result.judge.groundedness.toFixed(1)} avec chute correctness associee.`,
        });
      }
      if (
        baseline.sourceCoverage >= 3.5 &&
        result.sourceJudge.sourceCoverage <= baseline.sourceCoverage - 1.5
      ) {
        findings.push({
          questionId: result.questionId,
          kind: 'citation_loss',
          detail: `Source coverage ${baseline.sourceCoverage.toFixed(1)} -> ${result.sourceJudge.sourceCoverage.toFixed(1)}.`,
        });
      }
      if (
        result.judge.groundedness <= 2 &&
        result.judge.correctness >= 3 &&
        baseline.groundedness >= 3.5
      ) {
        findings.push({
          questionId: result.questionId,
          kind: 'hallucination_signal',
          detail: 'Groundedness effondre avec correctness elevee.',
        });
      }
    }

    if (TOPK30_GAINS.has(result.questionId)) {
      const smokeRef = input.smokeTop30ByQuestion.get(result.questionId);
      const marginalGold = result.metrics.goldNewInRanks21To30;
      if (marginalGold.length === 0 && smokeRef?.metrics.goldNewInRanks21To30.length) {
        findings.push({
          questionId: result.questionId,
          kind: 'topk30_gain_lost',
          detail: 'Gold marginal 21-30 absent vs smoke.',
        });
      }
      for (const gold of marginalGold.length
        ? marginalGold
        : (smokeRef?.metrics.goldNewInRanks21To30 ?? [])) {
        const inFinal = result.metrics.finalContextGoldHits.some((hit) =>
          goldArticlesMatch(hit, gold),
        );
        const inJina = result.reranking.some(
          (row) => row.rank <= 5 && goldArticlesMatch(gold, row),
        );
        if (!inJina || !inFinal) {
          findings.push({
            questionId: result.questionId,
            kind: 'topk30_gain_lost',
            detail: `Gold ${gold.corpusId}:${gold.articleNumber} n atteint pas Jina top5 / contexte final.`,
          });
        }
      }
    }
  }

  return findings;
}

export function classifyRegressionDecision(input: {
  findings: RegressionFinding[];
  topk30Results: RetrievalTop30SmokeQuestionResult[];
}): {
  category: RegressionDecision;
  rationale: string;
  nextStep: string;
} {
  const topkFindings = input.findings.filter((finding) =>
    TOPK30_GAINS.has(finding.questionId),
  );
  const nonTopkFindings = input.findings.filter(
    (finding) => !TOPK30_GAINS.has(finding.questionId),
  );

  if (topkFindings.length > 0) {
    return {
      category: 'REGRESSION',
      rationale:
        'Les 3 cas topK30 ne reproduisent pas le comportement du smoke (gain perdu ou rerank/filter).',
      nextStep:
        'Ne pas changer prod; comparer routing live vs replay sur q334/q367/q378.',
    };
  }

  const abstentionRegressions = input.findings.filter(
    (finding) => finding.kind === 'abstention_regression',
  );
  if (abstentionRegressions.length > 0) {
    return {
      category: 'REGRESSION',
      rationale: `${abstentionRegressions.length} regression(s) abstention detectee(s).`,
      nextStep:
        'Verifier routing abstain + absence retrieval avant tout changement topK.',
    };
  }

  const major = nonTopkFindings.filter(
    (finding) =>
      finding.kind === 'groundedness_drop' ||
      finding.kind === 'hallucination_signal',
  );
  if (major.length >= 2) {
    return {
      category: 'REGRESSION',
      rationale: 'Plusieurs regressions groundedness / hallucination.',
      nextStep: 'Analyser les questions en echec et garder retrievalTopK=20.',
    };
  }

  if (nonTopkFindings.length >= 3) {
    return {
      category: 'REGRESSION',
      rationale: `${nonTopkFindings.length} regressions detectees sur la mini-cohorte.`,
      nextStep: 'Isoler les questions regressives avant changement prod.',
    };
  }

  const topkOk = ['q334', 'q367', 'q378'].every((questionId) => {
    const result = input.topk30Results.find(
      (entry) => entry.questionId === questionId,
    );
    if (!result) {
      return false;
    }
    const marginal = result.metrics.goldNewInRanks21To30;
    if (marginal.length === 0) {
      return result.metrics.finalContextGoldHits.length > 0;
    }
    return marginal.every((gold) =>
      result.metrics.finalContextGoldHits.some((hit) =>
        goldArticlesMatch(hit, gold),
      ),
    );
  });

  return {
    category: topkOk ? 'NO_REGRESSION' : 'REGRESSION',
    rationale: topkOk
      ? 'Gains topK30 reproduits; pas de regression significative sur abstentions, multicorpus ou baselines.'
      : 'Verification topK30 incomplete.',
    nextStep: topkOk
      ? 'Appliquer retrievalTopK=30 en production (changement isole).'
      : 'Re-run cible sur cas topK30 avant prod.',
  };
}

export function baselineFromE2E(result: E2EQuestionResult): RegressionBaselineSnapshot {
  const routing = result.routing;
  return {
    source: 'e2e500_routing',
    correctness: routing?.judge?.correctness ?? 0,
    completeness: routing?.judge?.completeness ?? 0,
    groundedness: routing?.judge?.groundedness ?? 0,
    sourceRelevance: routing?.sourceJudge?.sourceRelevance ?? 0,
    sourceCoverage: routing?.sourceJudge?.sourceCoverage ?? 0,
    abstentionCorrect: routing?.judge?.abstentionCorrect ?? false,
  };
}

export function buildTopK30VerificationRows(
  results: RetrievalTop30SmokeQuestionResult[],
  smokeReference: Map<string, RetrievalTop30SmokeQuestionResult>,
): Array<{
  questionId: string;
  gold: string;
  rank30: number | null;
  jinaRank: number | null;
  inFinalContext: boolean;
  completeness: number;
  correctness: number;
  groundedness: number;
  smokeCompleteness: number;
}> {
  const rows = [];
  for (const questionId of ['q334', 'q367', 'q378']) {
    const result = results.find((entry) => entry.questionId === questionId);
    if (!result) {
      continue;
    }
    const gold =
      result.metrics.goldNewInRanks21To30[0] ??
      smokeReference.get(questionId)?.metrics.goldNewInRanks21To30[0];
    if (!gold) {
      continue;
    }
    const rankRow = result.retrieval.find(
      (row) => row.rank <= 30 && goldArticlesMatch(gold, row),
    );
    const jinaRow = result.reranking.find((row) => goldArticlesMatch(gold, row));
    rows.push({
      questionId,
      gold: `${gold.corpusId}:${gold.articleNumber}`,
      rank30: rankRow?.rank ?? null,
      jinaRank: jinaRow?.rank ?? null,
      inFinalContext: result.metrics.finalContextGoldHits.some((hit) =>
        goldArticlesMatch(hit, gold),
      ),
      completeness: result.judge.completeness,
      correctness: result.judge.correctness,
      groundedness: result.judge.groundedness,
      smokeCompleteness:
        smokeReference.get(questionId)?.judge.completeness ?? 0,
    });
  }
  return rows;
}
