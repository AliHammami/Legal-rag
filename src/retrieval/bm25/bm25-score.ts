import { tokenizeForLexical } from './tokenize.js';

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
