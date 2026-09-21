import { describe, expect, it } from 'vitest';

import {
  classifyGenerationForensic,
  type GenerationForensicRecord,
} from '../multicorpus/generation-forensic-audit.js';
import type { E2EQuestionResult } from '../multicorpus/types.js';
import type { LegalMulticorpusEvaluationQuestion } from '../multicorpus-dataset.types.js';

function makeQuestion(
  overrides: Partial<LegalMulticorpusEvaluationQuestion> = {},
): LegalMulticorpusEvaluationQuestion {
  return {
    id: 'q001',
    question: 'Question test',
    goldCorpusIds: ['code-penal'],
    goldArticles: [{ corpusId: 'code-penal', articleNumber: '222-1' }],
    referenceAnswer: 'Ref',
    difficulty: 'easy',
    questionType: 'single-corpus',
    ...overrides,
  };
}

function makeE2e(routing: E2EQuestionResult['routing']): E2EQuestionResult {
  return {
    questionId: 'q001',
    questionType: 'single-corpus',
    difficulty: 'easy',
    expectedAbstention: false,
    baseline: routing,
    routing,
    failureStage: 'generation',
  };
}

describe('generation-forensic-audit', () => {
  it('classifies missing gold article as context insufficient (A)', () => {
    const record = classifyGenerationForensic({
      question: makeQuestion(),
      e2e: makeE2e({
        answer: 'Impossible sans article 222-1',
        sources: [{ corpusId: 'code-penal', articleNumber: '222-3' }],
        profiling: {} as E2EQuestionResult['routing']['profiling'],
        judge: {
          questionId: 'q001',
          correctness: 0,
          completeness: 0,
          groundedness: 4,
          abstentionCorrect: false,
          explanation: 'Le contexte ne contient pas l article 222-1.',
        },
        sourceJudge: {
          sourceRelevance: 2,
          sourceCoverage: 4,
          explanation: 'Article gold absent.',
        },
      }),
    });

    expect(record.forensicCategory).toBe('A');
    expect(record.goldArticlesMissingFromContext).toHaveLength(1);
  });

  it('classifies all gold present with judge blame on answer as true generation (B)', () => {
    const record = classifyGenerationForensic({
      question: makeQuestion(),
      e2e: makeE2e({
        answer: 'Reponse incomplete',
        sources: [{ corpusId: 'code-penal', articleNumber: '222-1' }],
        profiling: {} as E2EQuestionResult['routing']['profiling'],
        judge: {
          questionId: 'q001',
          correctness: 2,
          completeness: 2,
          groundedness: 4,
          abstentionCorrect: false,
          explanation:
            'La reponse omet un element pourtant present dans le contexte fourni.',
        },
        sourceJudge: {
          sourceRelevance: 4,
          sourceCoverage: 4,
          explanation: 'Sources couvrent la reponse attendue.',
        },
      }),
    });

    expect(record.forensicCategory).toBe('B');
    expect(record.forensicSubCause).toBeDefined();
  });
});
