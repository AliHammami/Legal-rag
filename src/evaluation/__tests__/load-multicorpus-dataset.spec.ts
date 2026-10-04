import { describe, expect, it } from 'vitest';

import {
  normalizeQuestionText,
  parseMulticorpusEvaluationQuestion,
} from '../load-multicorpus-dataset.js';

describe('loadMulticorpusEvaluationDataset', () => {
  it('parses a valid multicorpus question', () => {
    const parsed = parseMulticorpusEvaluationQuestion(
      {
        id: 'q001',
        question: 'Question test',
        goldCorpusIds: ['code-penal'],
        goldArticles: [{ corpusId: 'code-penal', articleNumber: '122-5' }],
        referenceAnswer: 'Réponse',
        difficulty: 'easy',
        questionType: 'single-corpus',
        sourceArticles: [{ corpusId: 'code-penal', articleNumber: '122-5' }],
      },
      0,
    );

    expect(parsed.id).toBe('q001');
    expect(parsed.questionType).toBe('single-corpus');
    expect(parsed.goldArticles[0]?.corpusId).toBe('code-penal');
  });

  it('normalizes question text for duplicate detection', () => {
    expect(normalizeQuestionText('  Quelle peine ?  ')).toBe('quelle peine');
  });
});
