import { describe, expect, it } from 'vitest';

import { analyzeQuestionRerankScores } from '../analyze-reranker-scores.js';
import {
  computeEntryRelativeScore,
  evaluateQuestionAtThreshold,
  evaluateRelativeScoreThreshold,
  evaluateRelativeScoreThresholds,
  buildThresholdSensitivityReport,
} from '../analyze-reranker-threshold-sensitivity.js';
import type { EvaluationQuestion } from '../types.js';
import type { RerankedChunk } from '../../reranking/types.js';

function makeChunk(chunkId: string, rerankScore: number): RerankedChunk {
  const articleNumber = chunkId.split('#')[0] ?? chunkId;

  return {
    chunkId,
    articleNumber,
    content: `Content for ${chunkId}`,
    distance: 0.2,
    rerankScore,
    metadata: {
      articleNumber,
      pageStart: 1,
      pageEnd: 1,
      source: 'data/code-penal.pdf',
      sourceType: 'pdf',
      chunkIndex: 0,
      chunkCount: 1,
      unitStart: 0,
      unitEnd: 0,
      unitCount: 1,
    },
  };
}

function makeAnalysis(
  question: EvaluationQuestion,
  reranked: RerankedChunk[],
) {
  return analyzeQuestionRerankScores(question, reranked);
}

const q001: EvaluationQuestion = {
  id: 'q001',
  question: 'Quelles sont les conditions de la légitime défense ?',
  goldArticles: ['122-5', '122-6'],
};

const q001Reranked = [
  makeChunk('122-6#0', 0.2965),
  makeChunk('122-5#0', 0.1197),
  makeChunk('462-9#0', 0.0591),
  makeChunk('462-11#0', 0.0402),
  makeChunk('122-7#0', 0.0311),
];

const q010: EvaluationQuestion = {
  id: 'q010',
  question:
    "Dans quels cas l'exécution d'un ordre ou d'un acte prescrit par la loi peut-elle exclure la responsabilité pénale ?",
  goldArticles: ['122-4'],
};

const q010Reranked = [
  makeChunk('462-8#0', 0.5257),
  makeChunk('122-4#0', 0.2747),
  makeChunk('213-4#0', 0.2214),
  makeChunk('122-3#0', 0.0983),
  makeChunk('122-5#0', 0.0646),
];

describe('computeEntryRelativeScore', () => {
  it('computes score relative to the best score', () => {
    const analysis = makeAnalysis(q001, q001Reranked);

    expect(
      computeEntryRelativeScore(analysis.results[1]!, analysis.results[0]!.score),
    ).toBeCloseTo(0.1197 / 0.2965, 5);
  });
});

describe('evaluateQuestionAtThreshold', () => {
  it('keeps a document exactly at 40% relative score', () => {
    const analysis = makeAnalysis(q001, q001Reranked);
    const evaluation = evaluateQuestionAtThreshold(analysis, 0.4);

    expect(evaluation.keptArticles).toContain('122-5');
    expect(evaluation.goldKept).toEqual(['122-6', '122-5']);
    expect(evaluation.goldLost).toEqual([]);
  });

  it('counts kept documents correctly', () => {
    const analysis = makeAnalysis(q001, q001Reranked);
    const evaluation = evaluateQuestionAtThreshold(analysis, 0.3);

    expect(evaluation.keptDocumentsCount).toBe(2);
    expect(evaluation.keptArticles).toEqual(['122-6', '122-5']);
  });

  it('does not inflate gold recall with duplicate chunks of the same article', () => {
    const duplicateReranked = [
      makeChunk('122-6#0', 0.5),
      makeChunk('122-6#1', 0.49),
      makeChunk('462-9#0', 0.1),
    ];
    const analysis = makeAnalysis(q001, duplicateReranked);
    const evaluation = evaluateQuestionAtThreshold(analysis, 0.2);

    expect(evaluation.keptDocumentsCount).toBe(3);
    expect(evaluation.goldKept).toEqual(['122-6']);
    expect(evaluation.goldKept).toHaveLength(1);
  });
});

describe('evaluateRelativeScoreThreshold', () => {
  it('keeps all gold at 30% and 40%', () => {
    const analyses = [
      makeAnalysis(q001, q001Reranked),
      makeAnalysis(q010, q010Reranked),
    ];

    expect(evaluateRelativeScoreThreshold(analyses, 0.3).questionsLosingGold).toBe(
      0,
    );
    expect(evaluateRelativeScoreThreshold(analyses, 0.4).questionsLosingGold).toBe(
      0,
    );
    expect(evaluateRelativeScoreThreshold(analyses, 0.3).goldRecallPercent).toBe(
      100,
    );
    expect(evaluateRelativeScoreThreshold(analyses, 0.4).goldRecallPercent).toBe(
      100,
    );
  });

  it('loses q001 gold at 50% while q010 remains safe', () => {
    const analyses = [
      makeAnalysis(q001, q001Reranked),
      makeAnalysis(q010, q010Reranked),
    ];
    const evaluation = evaluateRelativeScoreThreshold(analyses, 0.5);

    expect(evaluation.questionsLosingGold).toBe(1);
    expect(
      evaluation.questionEvaluations.find(
        (questionEvaluation) => questionEvaluation.questionId === 'q001',
      )?.goldLost,
    ).toEqual(['122-5']);
    expect(
      evaluation.questionEvaluations.find(
        (questionEvaluation) => questionEvaluation.questionId === 'q010',
      )?.losesGold,
    ).toBe(false);
  });
});

describe('buildThresholdSensitivityReport', () => {
  it('computes recommendation from threshold evaluations', () => {
    const analyses = [
      makeAnalysis(q001, q001Reranked),
      makeAnalysis(q010, q010Reranked),
    ];
    const report = buildThresholdSensitivityReport(analyses);

    expect(report.recommendation?.highestSafeThreshold).toBe(0.4);
    expect(report.recommendation?.lowestSafeThreshold).toBe(0.3);
    expect(report.thresholdEvaluations).toHaveLength(7);
  });
});

describe('evaluateRelativeScoreThresholds', () => {
  it('returns one evaluation per tested threshold', () => {
    const analyses = [makeAnalysis(q001, q001Reranked)];
    const evaluations = evaluateRelativeScoreThresholds(analyses);

    expect(evaluations.map((evaluation) => evaluation.threshold)).toEqual([
      0.3, 0.35, 0.375, 0.4, 0.425, 0.45, 0.5,
    ]);
  });
});
