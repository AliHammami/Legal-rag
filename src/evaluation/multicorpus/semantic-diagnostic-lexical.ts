import {
  normalizeFrenchText,
  tokenizeForLexical,
} from '../../retrieval/bm25/tokenize.js';

export { normalizeFrenchText, tokenizeForLexical };

export function uniqueTokens(text: string): Set<string> {
  return new Set(tokenizeForLexical(text));
}

export function jaccardSimilarity(left: string, right: string): number {
  const a = uniqueTokens(left);
  const b = uniqueTokens(right);
  if (a.size === 0 && b.size === 0) {
    return 0;
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

export function tokenOverlapCount(left: string, right: string): number {
  const a = uniqueTokens(left);
  let count = 0;
  for (const token of bTokens(right)) {
    if (a.has(token)) {
      count += 1;
    }
  }
  return count;
}

function bTokens(text: string): Set<string> {
  return uniqueTokens(text);
}

export function sharedTokenSample(
  left: string,
  right: string,
  limit = 8,
): string[] {
  const a = uniqueTokens(left);
  const shared: string[] = [];
  for (const token of uniqueTokens(right)) {
    if (a.has(token)) {
      shared.push(token);
      if (shared.length >= limit) {
        break;
      }
    }
  }
  return shared.sort();
}

export {
  buildBm25Index,
  scoreBm25,
  type Bm25Index,
} from '../../retrieval/bm25/bm25-score.js';

export function articleNumberPrefix(articleNumber: string): string {
  const parts = articleNumber.split('-');
  if (parts.length <= 1) {
    return articleNumber;
  }
  return parts.slice(0, -1).join('-');
}

export function areNeighborArticles(
  left: string,
  right: string,
  sameCorpus: boolean,
): boolean {
  if (!sameCorpus || left === right) {
    return false;
  }
  const leftPrefix = articleNumberPrefix(left);
  const rightPrefix = articleNumberPrefix(right);
  return leftPrefix.length > 0 && leftPrefix === rightPrefix;
}
