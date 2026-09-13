import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OpenAIService } from '../../openai/openai.service.js';
import { searchQuestion } from '../search-question.js';

const databaseUrl = process.env.DATABASE_URL;
const openAiKey = process.env.OPENAI_API_KEY;
const runIntegration =
  Boolean(databaseUrl) &&
  Boolean(openAiKey) &&
  process.env.RUN_DB_TESTS === 'true' &&
  process.env.RUN_OPENAI_TESTS === 'true';

describe.runIf(runIntegration)('searchQuestion (integration)', () => {
  let prisma: PrismaService;
  let openAIService: OpenAIService;

  beforeAll(async () => {
    const configService = {
      getOrThrow: (key: string) => {
        if (key === 'DATABASE_URL') {
          return databaseUrl!;
        }
        if (key === 'OPENAI_API_KEY') {
          return openAiKey!;
        }
        throw new Error(`Missing config: ${key}`);
      },
      get: (key: string) => {
        if (key === 'OPENAI_EMBEDDING_MODEL') {
          return 'text-embedding-3-large';
        }
        return undefined;
      },
    } as unknown as ConfigService;

    prisma = new PrismaService(configService);
    openAIService = new OpenAIService(configService);
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('embeds a real question and retrieves chunks from PostgreSQL', async () => {
    const results = await searchQuestion(
      prisma,
      openAIService,
      'Quelles sont les conditions de la légitime défense ?',
      5,
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);

    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.distance).toBeGreaterThanOrEqual(results[i - 1]!.distance);
    }
  });
});
