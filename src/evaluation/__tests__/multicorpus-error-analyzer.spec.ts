import { describe, expect, it } from 'vitest';

import {
  classifyFailureStage,
  classifyRoutingFailure,
} from '../multicorpus/error-analyzer.js';
import { FIXTURE_MULTICORPUS_QUESTIONS } from './fixtures/multicorpus-dataset.fixture.js';

describe('multicorpus error analyzer', () => {
  it('detects routing failure when predicted corpora differ', () => {
    const question = FIXTURE_MULTICORPUS_QUESTIONS[2]!;
    const failed = classifyRoutingFailure(question, {
      questionId: question.id,
      questionType: question.questionType,
      difficulty: question.difficulty,
      goldCorpusIds: question.goldCorpusIds,
      predictedCorpusIds: ['code-penal'],
      exactMatch: false,
      precision: 0.5,
      recall: 0.5,
      f1: 0.5,
      latencyMs: 10,
      fallbackToGlobal: false,
    });

    expect(failed).toBe(true);
  });

  it('returns none when no stage fails', () => {
    const question = FIXTURE_MULTICORPUS_QUESTIONS[0]!;
    expect(
      classifyFailureStage({
        question,
        routing: {
          questionId: question.id,
          questionType: question.questionType,
          difficulty: question.difficulty,
          goldCorpusIds: question.goldCorpusIds,
          predictedCorpusIds: question.goldCorpusIds,
          exactMatch: true,
          precision: 1,
          recall: 1,
          f1: 1,
          latencyMs: 10,
          fallbackToGlobal: false,
        },
        retrieval: {
          questionId: question.id,
          questionType: question.questionType,
          difficulty: question.difficulty,
          goldArticles: question.goldArticles,
          global: { recallAt5: 1, recallAt10: 1, recallAt20: 1, mrr: 1 },
          routed: { recallAt5: 1, recallAt10: 1, recallAt20: 1, mrr: 1 },
          latencyMs: { global: 1, routed: 2 },
        },
      }),
    ).toBe('none');
  });
});
