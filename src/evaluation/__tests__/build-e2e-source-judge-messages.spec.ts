import { describe, expect, it } from 'vitest';

import { buildE2ESourceJudgeMessages } from '../build-e2e-source-judge-messages.js';

describe('buildE2ESourceJudgeMessages', () => {
  it('includes sources and judge result without goldArticles', () => {
    const messages = buildE2ESourceJudgeMessages({
      questionId: 'q001',
      question: 'Question test',
      referenceAnswer: 'Référence',
      generatedAnswer: 'Réponse générée',
      expectedAbstention: false,
      sources: [
        {
          sourceId: 1,
          chunkId: '122-5#0',
          articleNumber: '122-5',
          content: 'Contenu source 1',
        },
        {
          sourceId: 2,
          chunkId: '122-6#0',
          articleNumber: '122-6',
          content: 'Contenu source 2',
        },
      ],
      judgeResult: {
        correctness: 4,
        completeness: 4,
        groundedness: 4,
        abstentionCorrect: true,
        explanation: 'ok',
      },
    });

    const userContent = messages[1]?.content;
    expect(typeof userContent).toBe('string');
    expect(userContent).toContain('QUESTION:');
    expect(userContent).toContain('Contenu source 1');
    expect(userContent).toContain('Contenu source 2');
    expect(userContent).toContain('JUDGE RESULT:');
    expect(userContent).not.toContain('goldArticles');
  });

  it('handles abstention questions', () => {
    const messages = buildE2ESourceJudgeMessages({
      questionId: 'q021',
      question: 'Question abstention',
      referenceAnswer: null,
      generatedAnswer: 'Le contexte ne permet pas de répondre.',
      expectedAbstention: true,
      sources: [
        {
          sourceId: 1,
          chunkId: 'R645-3#0',
          articleNumber: 'R645-3',
          content: 'Contenu hors sujet mais utile pour abstention.',
        },
      ],
      judgeResult: {
        correctness: 4,
        completeness: 4,
        groundedness: 4,
        abstentionCorrect: true,
        explanation: 'abstention correcte',
      },
    });

    const userContent = messages[1]?.content as string;
    expect(userContent).toContain('EXPECTED ABSTENTION: true');
    expect(userContent).toContain('R645-3');
  });
});
