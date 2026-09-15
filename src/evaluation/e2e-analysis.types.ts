export interface E2EAnalysisFilteredContextChunk {
  chunkId: string;
  articleNumber: string;
  rerankScore?: number;
}

export interface E2EAnalysisJudgeSnapshot {
  correctness: number;
  completeness: number;
  groundedness: number;
  abstentionCorrect: boolean;
  explanation: string;
}

export interface E2EAnalysisQuestion {
  id: string;
  question: string;
  expectedAbstention: boolean;
  goldArticles: string[];
  filteredContextChunks: E2EAnalysisFilteredContextChunk[];
  generatedAnswer: string | null;
  judge: E2EAnalysisJudgeSnapshot;
}

export interface E2EAnalysisSummary {
  totalQuestions: number;
  normalQuestions: number;
  abstentionQuestions: number;
  averageCorrectness: number;
  averageCompleteness: number;
  averageGroundedness: number;
  problematicQuestionIds: string[];
}

export interface E2EAnalysisFile {
  summary: E2EAnalysisSummary;
  questions: E2EAnalysisQuestion[];
}
