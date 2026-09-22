const FRENCH_STOP = new Set([
  'le',
  'la',
  'les',
  'de',
  'du',
  'des',
  'un',
  'une',
  'et',
  'ou',
  'en',
  'au',
  'aux',
  'par',
  'pour',
  'dans',
  'sur',
  'que',
  'qui',
  'qu',
  'est',
  'sont',
  'ce',
  'cette',
  'ses',
  'son',
  'sa',
  'their',
  'the',
  'a',
]);

export function normalizeFrenchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function tokenizeForLexical(text: string): string[] {
  const normalized = normalizeFrenchText(text);
  const raw = normalized.match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? [];
  return raw.filter((token) => token.length > 1 && !FRENCH_STOP.has(token));
}

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

export interface Bm25Index {
  documents: Array<{ id: string; tokens: string[]; length: number }>;
  avgDocLength: number;
  docFreq: Map<string, number>;
  corpusSize: number;
}

export function buildBm25Index(
  documents: Array<{ id: string; text: string }>,
): Bm25Index {
  const docs = documents.map((doc) => {
    const tokens = tokenizeForLexical(doc.text);
    return { id: doc.id, tokens, length: tokens.length };
  });
  const docFreq = new Map<string, number>();
  for (const doc of docs) {
    for (const token of new Set(doc.tokens)) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }
  const avgDocLength =
    docs.length === 0
      ? 0
      : docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length;
  return {
    documents: docs,
    avgDocLength,
    docFreq,
    corpusSize: docs.length,
  };
}

export function scoreBm25(
  index: Bm25Index,
  query: string,
  k1 = 1.2,
  b = 0.75,
): Array<{ id: string; score: number }> {
  const queryTokens = tokenizeForLexical(query);
  const scores = new Map<string, number>();

  for (const doc of index.documents) {
    let score = 0;
    for (const term of queryTokens) {
      const df = index.docFreq.get(term) ?? 0;
      if (df === 0) {
        continue;
      }
      const idf = Math.log(
        1 + (index.corpusSize - df + 0.5) / (df + 0.5),
      );
      const tf = doc.tokens.filter((token) => token === term).length;
      const denom =
        tf + k1 * (1 - b + (b * doc.length) / (index.avgDocLength || 1));
      score += idf * ((tf * (k1 + 1)) / denom);
    }
    if (score > 0) {
      scores.set(doc.id, score);
    }
  }

  return [...scores.entries()]
    .map(([id, value]) => ({ id, score: value }))
    .sort((left, right) => right.score - left.score);
}

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
