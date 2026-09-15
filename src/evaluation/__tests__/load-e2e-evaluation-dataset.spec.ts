import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { EvaluationError } from '../evaluation.error.js';
import { loadCorpusArticleNumbersFromArticlesFile } from '../load-corpus-articles.js';
import {
  loadE2EEvaluationDataset,
  validateE2EGoldArticles,
  validateE2EGoldArticlesInCorpus,
  validateE2EQuestionIds,
  validateE2EQuestionTexts,
  validateE2EReferenceAnswers,
} from '../load-e2e-evaluation-dataset.js';
import {
  assertValidE2EEvaluationDataset,
  validateE2EEvaluationDataset,
} from '../validate-e2e-dataset.js';

const tempDirs: string[] = [];

afterEach(() => {
  tempDirs.length = 0;
});

async function writeDataset(content: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'penal-e2e-eval-'));
  tempDirs.push(dir);
  const path = join(dir, 'dataset.json');
  await writeFile(path, JSON.stringify(content), 'utf-8');
  return path;
}

const normalQuestion = {
  id: 'q001',
  question: 'Quelles sont les conditions de la légitime défense ?',
  goldArticles: ['122-5', '122-6'],
  referenceAnswer: 'Réponse de référence.',
  expectedAbstention: false,
};

const abstentionQuestion = {
  id: 'q021',
  question: 'Quelle est la durée légale du préavis en cas de licenciement économique ?',
  goldArticles: [],
  referenceAnswer: null,
  expectedAbstention: true,
};

describe('loadE2EEvaluationDataset', () => {
  it('loads a valid E2E dataset', async () => {
    const path = await writeDataset([normalQuestion, abstentionQuestion]);
    const questions = await loadE2EEvaluationDataset(path);

    expect(questions).toHaveLength(2);
    expect(questions[0]?.referenceAnswer).toBe('Réponse de référence.');
    expect(questions[1]?.expectedAbstention).toBe(true);
  });

  it('rejects a normal question without referenceAnswer', async () => {
    const path = await writeDataset([
      {
        ...normalQuestion,
        referenceAnswer: null,
      },
    ]);

    await expect(loadE2EEvaluationDataset(path)).resolves.toHaveLength(1);
    expect(
      validateE2EReferenceAnswers(await loadE2EEvaluationDataset(path)),
    ).toContain('q001: normal question must have a referenceAnswer');
  });
});

describe('validateE2EQuestionIds', () => {
  it('accepts consistent ids and rejects invalid formats', () => {
    expect(
      validateE2EQuestionIds([
        {
          ...normalQuestion,
          id: 'q001',
        },
      ]),
    ).toEqual([]);

    expect(() =>
      validateE2EQuestionIds([
        {
          ...normalQuestion,
          id: 'question-1',
        },
      ]),
    ).toThrow(EvaluationError);
  });

  it('detects duplicate ids', () => {
    expect(
      validateE2EQuestionIds([
        { ...normalQuestion, id: 'q001' },
        { ...normalQuestion, id: 'q001', question: 'Autre question ?' },
      ]),
    ).toEqual(['q001']);
  });
});

describe('validateE2EQuestionTexts', () => {
  it('detects duplicate question texts', () => {
    expect(
      validateE2EQuestionTexts([
        { ...normalQuestion, id: 'q001' },
        { ...normalQuestion, id: 'q002' },
      ]),
    ).toEqual(['q001, q002']);
  });
});

describe('validateE2EGoldArticles', () => {
  it('requires gold articles for normal questions and none for abstention', () => {
    expect(validateE2EGoldArticles([normalQuestion])).toEqual([]);
    expect(validateE2EGoldArticles([abstentionQuestion])).toEqual([]);
    expect(
      validateE2EGoldArticles([
        {
          ...normalQuestion,
          goldArticles: [],
        },
      ]),
    ).toContain('q001: normal question must have at least one gold article');
    expect(
      validateE2EGoldArticles([
        {
          ...abstentionQuestion,
          goldArticles: ['122-5'],
        },
      ]),
    ).toContain('q021: abstention question must have goldArticles = []');
  });
});

describe('validateE2EGoldArticlesInCorpus', () => {
  it('rejects missing gold articles and accepts existing ones', () => {
    expect(
      validateE2EGoldArticlesInCorpus(
        [normalQuestion],
        new Set(['122-5', '122-6']),
      ),
    ).toEqual([]);
    expect(
      validateE2EGoldArticlesInCorpus(
        [normalQuestion],
        new Set(['122-5']),
      ),
    ).toEqual(['q001: 122-6']);
  });
});

describe('validateE2EReferenceAnswers', () => {
  it('validates reference answers for normal and abstention questions', () => {
    expect(validateE2EReferenceAnswers([normalQuestion])).toEqual([]);
    expect(validateE2EReferenceAnswers([abstentionQuestion])).toEqual([]);
    expect(
      validateE2EReferenceAnswers([
        {
          ...abstentionQuestion,
          referenceAnswer: 'Réponse interdite',
        },
      ]),
    ).toContain('q021: abstention question must have referenceAnswer = null');
  });
});

describe('validateE2EEvaluationDataset', () => {
  it('builds a valid summary for a correct dataset', () => {
    const summary = validateE2EEvaluationDataset(
      [normalQuestion, abstentionQuestion],
      new Set(['122-5', '122-6']),
    );

    expect(summary.isValid).toBe(true);
    expect(summary.normalQuestionCount).toBe(1);
    expect(summary.abstentionQuestionCount).toBe(1);
    expect(() => assertValidE2EEvaluationDataset(summary)).not.toThrow();
  });

  it('marks the dataset invalid when a gold article is missing from the corpus', () => {
    const summary = validateE2EEvaluationDataset(
      [normalQuestion],
      new Set(['122-5']),
    );

    expect(summary.isValid).toBe(false);
    expect(summary.missingCorpusArticles).toEqual(['q001: 122-6']);
    expect(() => assertValidE2EEvaluationDataset(summary)).toThrow(
      /Missing corpus article/,
    );
  });
});

describe('default E2E dataset file', () => {
  it('loads and validates the repository dataset', async () => {
    const questions = await loadE2EEvaluationDataset(
      'data/evaluation/code-penal.e2e.questions.json',
    );
    const corpusArticleNumbers = await loadCorpusArticleNumbersFromArticlesFile(
      'data/processed/code-penal.articles.json',
    );
    const summary = validateE2EEvaluationDataset(
      questions,
      corpusArticleNumbers,
    );

    expect(questions).toHaveLength(25);
    expect(summary.questionCount).toBe(25);
    expect(summary.normalQuestionCount).toBe(20);
    expect(summary.abstentionQuestionCount).toBe(5);
    expect(summary.isValid).toBe(true);
  });
});
