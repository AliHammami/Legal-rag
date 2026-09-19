import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { LegalMulticorpusEvaluationQuestion } from '../multicorpus-dataset.types.js';
import type { EvaluationMode, MulticorpusModelConfiguration } from './types.js';

export function buildMulticorpusCacheKey(input: {
  questionId: string;
  mode: string;
  modelConfiguration: MulticorpusModelConfiguration;
}): string {
  const payload = JSON.stringify({
    questionId: input.questionId,
    mode: input.mode,
    modelConfiguration: input.modelConfiguration,
    evaluatorVersion: '1.0.0',
  });

  return createHash('sha256').update(payload).digest('hex');
}

export async function readCachedResult<T>(
  runDir: string,
  mode: string,
  cacheKey: string,
): Promise<T | undefined> {
  const path = join(runDir, `${mode}-cache`, `${cacheKey}.json`);
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export async function writeCachedResult<T>(
  runDir: string,
  mode: string,
  cacheKey: string,
  value: T,
): Promise<void> {
  const path = join(runDir, `${mode}-cache`, `${cacheKey}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

export function questionsForEvaluationMode(
  mode: EvaluationMode,
  questions: LegalMulticorpusEvaluationQuestion[],
): LegalMulticorpusEvaluationQuestion[] {
  if (mode === 'retrieval' || mode === 'reranking') {
    return questions.filter(
      (question) =>
        question.questionType === 'single-corpus' ||
        question.questionType === 'multi-corpus',
    );
  }

  return questions;
}

/** Returns cached per-question results when every question for the mode is present. */
export async function loadCachedPhaseResults<T>(
  runDir: string,
  mode: EvaluationMode,
  questions: LegalMulticorpusEvaluationQuestion[],
  modelConfiguration: MulticorpusModelConfiguration,
): Promise<T[] | undefined> {
  const scopedQuestions = questionsForEvaluationMode(mode, questions);
  const results: T[] = [];

  for (const question of scopedQuestions) {
    const cacheKey = buildMulticorpusCacheKey({
      questionId: question.id,
      mode,
      modelConfiguration,
    });
    const cached = await readCachedResult<T>(runDir, mode, cacheKey);
    if (!cached) {
      return undefined;
    }
    results.push(cached);
  }

  return results;
}
