import type {
  QuestionThresholdEvaluation,
  RelativeScoreThresholdEvaluation,
  ThresholdSensitivityRecommendation,
  ThresholdSensitivityReport,
} from './analyze-reranker-threshold-sensitivity.js';

function formatThresholdPercent(threshold: number): string {
  const percent = threshold * 100;
  return Number.isInteger(percent) ? `${percent}%` : `${percent}%`;
}

function formatPercentValue(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatThresholdSensitivityTable(
  evaluations: RelativeScoreThresholdEvaluation[],
): string {
  const header =
    'Threshold    Avg docs    Questions losing gold    Gold recall';
  const separator =
    '-----------  ----------  ---------------------  -----------';

  const rows = evaluations.map((evaluation) => {
    const threshold = formatThresholdPercent(evaluation.threshold).padEnd(11);
    const averageDocuments = evaluation.averageDocumentsKept
      .toFixed(2)
      .padEnd(10);
    const questionsLosingGold = String(evaluation.questionsLosingGold).padEnd(
      21,
    );
    const goldRecall = formatPercentValue(evaluation.goldRecallPercent);

    return `${threshold}  ${averageDocuments}  ${questionsLosingGold}  ${goldRecall}`;
  });

  return [header, separator, ...rows].join('\n');
}

function formatProblematicQuestion(
  evaluation: QuestionThresholdEvaluation,
): string {
  const goldLabel = evaluation.goldLost.join(', ');
  const lostGold = evaluation.lostGoldDetails[0];
  const goldRatio = lostGold
    ? formatPercentValue(lostGold.relativeScore * 100)
    : 'n/a';

  return [
    evaluation.questionId,
    `  Gold: ${goldLabel}`,
    `  Best: ${evaluation.bestEntry.articleNumber} (${evaluation.bestEntry.score.toFixed(4)})`,
    `  Gold ratio: ${goldRatio}`,
    `  Result: GOLD LOST`,
  ].join('\n');
}

export function formatProblematicQuestionsSection(
  evaluation: RelativeScoreThresholdEvaluation,
): string | null {
  const problematicQuestions = evaluation.questionEvaluations.filter(
    (questionEvaluation) => questionEvaluation.losesGold,
  );

  if (problematicQuestions.length === 0) {
    return null;
  }

  const lines = [
    `Threshold ${formatThresholdPercent(evaluation.threshold)}`,
    '-------------',
    ...problematicQuestions.map(formatProblematicQuestion),
  ];

  return lines.join('\n');
}

export function formatThresholdSensitivityRecommendation(
  recommendation: ThresholdSensitivityRecommendation,
): string {
  return [
    'RECOMMENDATION',
    '==============',
    '',
    `Lowest tested threshold with 0 gold loss: ${formatThresholdPercent(recommendation.lowestSafeThreshold)}`,
    `Highest tested threshold with 0 gold loss: ${formatThresholdPercent(recommendation.highestSafeThreshold)}`,
    '',
    `Average documents retained at highest safe threshold: ${recommendation.averageDocumentsAtHighestSafe.toFixed(2)}`,
    '',
    recommendation.nextFailingThreshold === null
      ? 'Margin to next failure threshold: none within tested range'
      : `Margin to next failure threshold: ${recommendation.marginToNextFailurePercentPoints.toFixed(1)} percentage points (next failure at ${formatThresholdPercent(recommendation.nextFailingThreshold)})`,
  ].join('\n');
}

export function formatThresholdSensitivityReport(
  report: ThresholdSensitivityReport,
): string {
  const sections = [
    'RERANKER THRESHOLD SENSITIVITY',
    '==============================',
    '',
    formatThresholdSensitivityTable(report.thresholdEvaluations),
  ];

  const problematicSections = report.thresholdEvaluations
    .map(formatProblematicQuestionsSection)
    .filter((section): section is string => section !== null);

  if (problematicSections.length > 0) {
    sections.push('', ...problematicSections);
  }

  if (report.recommendation) {
    sections.push('', formatThresholdSensitivityRecommendation(report.recommendation));
  }

  return sections.join('\n');
}
