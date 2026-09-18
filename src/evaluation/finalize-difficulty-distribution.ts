import type {
  LegalMulticorpusEvaluationQuestion,
  MulticorpusDifficulty,
} from './multicorpus-dataset.types.js';
import { MULTICORPUS_DIFFICULTY_TARGETS } from './multicorpus-dataset.types.js';

function difficultyScore(question: LegalMulticorpusEvaluationQuestion): number {
  if (question.questionType === 'ambiguous' || question.questionType === 'out-of-scope') {
    return 2;
  }

  if (question.questionType === 'multi-corpus') {
    return 3 + Math.min(question.goldArticles.length, 2);
  }

  if (question.goldArticles.length >= 3) {
    return 3;
  }

  if (question.goldArticles.length === 2) {
    return 2;
  }

  if (question.question.length > 140) {
    return 2;
  }

  return 1;
}

export function finalizeDifficultyDistribution(
  questions: LegalMulticorpusEvaluationQuestion[],
): LegalMulticorpusEvaluationQuestion[] {
  const targets = { ...MULTICORPUS_DIFFICULTY_TARGETS };
  const scored = questions.map((question, index) => ({
    question,
    score: difficultyScore(question),
    index,
  }));

  scored.sort((left, right) => left.score - right.score || left.index - right.index);

  const assignments = new Map<string, MulticorpusDifficulty>();
  let easyLeft = targets.easy;
  let mediumLeft = targets.medium;
  let hardLeft = targets.hard;

  for (const entry of scored) {
    let difficulty: MulticorpusDifficulty;
    if (entry.score <= 1 && easyLeft > 0) {
      difficulty = 'easy';
      easyLeft -= 1;
    } else if (entry.score >= 4 && hardLeft > 0) {
      difficulty = 'hard';
      hardLeft -= 1;
    } else if (mediumLeft > 0) {
      difficulty = 'medium';
      mediumLeft -= 1;
    } else if (hardLeft > 0) {
      difficulty = 'hard';
      hardLeft -= 1;
    } else {
      difficulty = 'easy';
      easyLeft -= 1;
    }

    assignments.set(entry.question.id, difficulty);
  }

  return questions.map((question) => ({
    ...question,
    difficulty: assignments.get(question.id) ?? question.difficulty,
  }));
}
