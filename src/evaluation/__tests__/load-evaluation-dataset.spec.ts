import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { EvaluationError } from '../evaluation.error.js';
import {
  loadEvaluationDataset,
  validateGoldArticlesInCorpus,
} from '../load-evaluation-dataset.js';

const tempDirs: string[] = [];

afterEach(async () => {
  tempDirs.length = 0;
});

async function writeDataset(content: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'penal-eval-'));
  tempDirs.push(dir);
  const path = join(dir, 'dataset.json');
  await writeFile(path, JSON.stringify(content), 'utf-8');
  return path;
}

describe('loadEvaluationDataset', () => {
  it('loads a valid dataset', async () => {
    const path = await writeDataset([
      {
        id: 'q001',
        question: 'Question ?',
        goldArticles: ['122-5'],
      },
    ]);

    const questions = await loadEvaluationDataset(path);
    expect(questions).toHaveLength(1);
    expect(questions[0]?.id).toBe('q001');
  });

  it('rejects duplicate ids', async () => {
    const path = await writeDataset([
      { id: 'q001', question: 'A ?', goldArticles: ['122-5'] },
      { id: 'q001', question: 'B ?', goldArticles: ['122-6'] },
    ]);

    await expect(loadEvaluationDataset(path)).rejects.toMatchObject({
      code: 'DATASET_DUPLICATE_ID',
    });
  });

  it('rejects empty goldArticles', async () => {
    const path = await writeDataset([
      { id: 'q001', question: 'A ?', goldArticles: [] },
    ]);

    await expect(loadEvaluationDataset(path)).rejects.toBeInstanceOf(
      EvaluationError,
    );
  });
});

describe('validateGoldArticlesInCorpus', () => {
  it('passes when all gold articles exist in the corpus', () => {
    expect(() =>
      validateGoldArticlesInCorpus(
        [{ id: 'q001', question: 'Q ?', goldArticles: ['122-5', '122-6'] }],
        new Set(['122-5', '122-6', '122-7']),
      ),
    ).not.toThrow();
  });

  it('fails when a gold article is missing from the corpus', () => {
    expect(() =>
      validateGoldArticlesInCorpus(
        [{ id: 'q001', question: 'Q ?', goldArticles: ['999-9'] }],
        new Set(['122-5']),
      ),
    ).toThrow(EvaluationError);
  });
});
