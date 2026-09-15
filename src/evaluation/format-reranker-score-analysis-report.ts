import { average } from './metrics.js';
import type {
  QuestionRerankScoreAnalysis,
  RerankerScoreAnalysisReport,
  RelativeThresholdSummary,
} from './analyze-reranker-scores.js';

function formatPercent(value: number): string {
  return `${Math.round(value * 100)} %`;
}

function formatNumber(value: number, digits = 4): string {
  return value.toFixed(digits);
}

export function formatQuestionRerankScoreAnalysis(
  analysis: QuestionRerankScoreAnalysis,
): string {
  const lines = [
    `${analysis.question.id} — ${analysis.question.question}`,
    `Gold articles : ${analysis.question.goldArticles.join(', ')}`,
    `Gold présents dans Top 5 : ${analysis.goldArticlesInTop5}/${analysis.question.goldArticles.length}`,
    `Rang du dernier gold : ${analysis.lastGoldRank ?? 'n/a'}`,
    '',
    'Résultats Jina :',
  ];

  for (const [index, entry] of analysis.results.entries()) {
    const relativeToBest = analysis.relativeToBest[index] ?? 0;
    lines.push(
      `#${entry.rank}  article=${entry.articleNumber}  score=${formatNumber(entry.score)}  relativeToBest=${formatNumber(relativeToBest)}  relevant=${entry.relevant}`,
    );
  }

  lines.push('', 'Écarts consécutifs :');
  if (analysis.gaps.length === 0) {
    lines.push('(aucun)');
  } else {
    for (const gap of analysis.gaps) {
      lines.push(
        `score[${gap.fromRank}] → score[${gap.toRank}] : gap=${formatNumber(gap.absoluteGap)}  ratio=${formatNumber(gap.ratio)}`,
      );
    }
  }

  if (analysis.largestGap) {
    lines.push(
      `Plus grand gap : score[${analysis.largestGap.fromRank}] → score[${analysis.largestGap.toRank}] (${formatNumber(analysis.largestGap.absoluteGap)})`,
    );
  }

  return lines.join('\n');
}

export function formatThresholdSummaryTable(
  summaries: RelativeThresholdSummary[],
): string {
  const header = 'Seuil relatif | Documents conservés moyen | Questions perdant un gold';
  const separator = '--------------|-----------------------------|---------------------------';
  const rows = summaries.map(
    (summary) =>
      `${formatPercent(summary.threshold).padEnd(13)} | ${summary.averageDocumentsKept.toFixed(2).padEnd(27)} | ${summary.questionsLosingGold}`,
  );

  return [header, separator, ...rows].join('\n');
}

export function formatRerankerScoreAnalysisReport(
  report: RerankerScoreAnalysisReport,
): string {
  const globalLines = [
    'RÉSUMÉ GLOBAL',
    `Questions analysées : ${report.questions.length}`,
    `Gold articles moyens dans Top 5 : ${average(report.questions.map((analysis) => analysis.goldArticlesInTop5)).toFixed(2)}`,
    `Rang moyen du dernier gold : ${average(
      report.questions
        .map((analysis) => analysis.lastGoldRank)
        .filter((rank): rank is number => rank !== null),
    ).toFixed(2)}`,
    '',
    'Seuils relatifs au meilleur score :',
    formatThresholdSummaryTable(report.thresholdSummaries),
  ];

  const questionSections = report.questions.map((analysis) =>
    formatQuestionRerankScoreAnalysis(analysis),
  );

  return [...questionSections, '', ...globalLines].join('\n\n');
}
