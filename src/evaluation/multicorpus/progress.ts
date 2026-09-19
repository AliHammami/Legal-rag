export function logEvaluationProgress(
  mode: string,
  completed: number,
  total: number,
  questionId: string,
  source: 'cache' | 'eval',
): void {
  const suffix = source === 'cache' ? ' (cache)' : '';
  console.log(`[${mode}] ${completed}/${total} ${questionId}${suffix}`);
}
