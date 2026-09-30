import { describe, expect, it, vi } from 'vitest';

import { E2ESourceJudgeService } from '../e2e-source-judge.service.js';

describe('E2ESourceJudgeService', () => {
  it('calls structured completion and returns parsed source judge result', async () => {
    const invoke = vi.fn().mockResolvedValue({
      sourceRelevance: 3,
      sourceCoverage: 2,
      explanation: 'Sources partiellement couvrantes.',
    });
    const openAIService = {
      createChatModel: vi.fn().mockReturnValue({
        withStructuredOutput: vi.fn().mockReturnValue({ invoke }),
      }),
    };

    const configService = {
      get: vi.fn().mockReturnValue('judge-test'),
    };

    const service = new E2ESourceJudgeService(
      configService as never,
      openAIService as never,
    );

    const result = await service.judgeSources({
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
          content: 'Contenu source',
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

    expect(result).toEqual({
      sourceRelevance: 3,
      sourceCoverage: 2,
      explanation: 'Sources partiellement couvrantes.',
    });
    expect(openAIService.createChatModel).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledOnce();
  });
});
