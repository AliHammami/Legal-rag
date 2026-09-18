import { normalizeQuestionText } from './load-multicorpus-dataset.js';
import type {
  LegalMulticorpusEvaluationQuestion,
  MulticorpusDuplicateGroup,
} from './multicorpus-dataset.types.js';

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeQuestionText(text)
      .split(' ')
      .filter((token) => token.length > 2),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function goldArticlesKey(question: LegalMulticorpusEvaluationQuestion): string {
  return [...question.goldCorpusIds].sort().join('|') + '::' + [...question.goldArticles].sort().join('|');
}

export function detectMulticorpusDuplicates(
  questions: LegalMulticorpusEvaluationQuestion[],
  lexicalThreshold = 0.92,
): MulticorpusDuplicateGroup[] {
  const groups: MulticorpusDuplicateGroup[] = [];
  const processedPairs = new Set<string>();

  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const left = questions[i]!;
      const right = questions[j]!;
      const pairKey = `${left.id}::${right.id}`;
      if (processedPairs.has(pairKey)) {
        continue;
      }
      processedPairs.add(pairKey);

      const normalizedLeft = normalizeQuestionText(left.question);
      const normalizedRight = normalizeQuestionText(right.question);

      if (normalizedLeft === normalizedRight) {
        groups.push({
          questionIds: [left.id, right.id],
          reason: 'identical normalized question text',
          similarity: 1,
        });
        continue;
      }

      const lexicalSimilarity = jaccardSimilarity(
        tokenize(left.question),
        tokenize(right.question),
      );

      if (lexicalSimilarity >= lexicalThreshold) {
        groups.push({
          questionIds: [left.id, right.id],
          reason: 'high lexical similarity',
          similarity: lexicalSimilarity,
        });
        continue;
      }

      if (
        goldArticlesKey(left) === goldArticlesKey(right) &&
        lexicalSimilarity >= 0.75
      ) {
        groups.push({
          questionIds: [left.id, right.id],
          reason: 'same gold articles with similar wording',
          similarity: lexicalSimilarity,
        });
      }
    }
  }

  return groups;
}

export function mergeDuplicateGroups(
  groups: MulticorpusDuplicateGroup[],
): MulticorpusDuplicateGroup[] {
  const adjacency = new Map<string, Set<string>>();

  for (const group of groups) {
    for (const id of group.questionIds) {
      if (!adjacency.has(id)) {
        adjacency.set(id, new Set());
      }
      adjacency.get(id)!.add(id);
      for (const otherId of group.questionIds) {
        adjacency.get(id)!.add(otherId);
      }
    }
  }

  const visited = new Set<string>();
  const merged: MulticorpusDuplicateGroup[] = [];

  for (const id of adjacency.keys()) {
    if (visited.has(id)) {
      continue;
    }

    const stack = [id];
    const component = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      component.add(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    if (component.size > 1) {
      const relatedGroups = groups.filter((group) =>
        group.questionIds.some((questionId) => component.has(questionId)),
      );
      merged.push({
        questionIds: [...component].sort(),
        reason: relatedGroups.map((group) => group.reason).join('; '),
        similarity: Math.max(...relatedGroups.map((group) => group.similarity)),
      });
    }
  }

  return merged;
}
