import type { SimilarChunk } from '../retrieval/types.js';
import type { RerankedChunk } from '../reranking/types.js';

export const DEFAULT_RETRIEVAL_DEBUG_PREVIEW_LENGTH = 300;

export const DEFAULT_DEBUG_ARTICLES_OF_INTEREST = [
  '122-5',
  '122-6',
  '122-7',
  '462-9',
  '462-11',
] as const;

function formatContentPreview(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength)}...`;
}

function quotePreview(content: string, maxLength: number): string {
  return `"${formatContentPreview(content, maxLength)}"`;
}

export function formatVectorSearchDebug(
  candidates: SimilarChunk[],
  previewLength = DEFAULT_RETRIEVAL_DEBUG_PREVIEW_LENGTH,
): string {
  const lines = ['Top 20 vector search', ''];

  if (candidates.length === 0) {
    lines.push('(aucun résultat)');
    return lines.join('\n');
  }

  for (const [index, candidate] of candidates.entries()) {
    lines.push(
      `#${index + 1}  article=${candidate.articleNumber}  chunk=${candidate.chunkId}  distance=${candidate.distance.toFixed(4)}`,
    );
    lines.push(quotePreview(candidate.content, previewLength));
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function formatJinaInputDebug(
  candidates: SimilarChunk[],
  previewLength = DEFAULT_RETRIEVAL_DEBUG_PREVIEW_LENGTH,
): string {
  const lines = ['Candidats envoyés à Jina', ''];

  if (candidates.length === 0) {
    lines.push('(aucun candidat)');
    return lines.join('\n');
  }

  for (const [index, candidate] of candidates.entries()) {
    lines.push(
      `index=${index}  article=${candidate.articleNumber}  chunk=${candidate.chunkId}`,
    );
    lines.push(quotePreview(candidate.content, previewLength));
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function findCandidateIndex(
  candidates: SimilarChunk[],
  chunkId: string,
): number {
  return candidates.findIndex((candidate) => candidate.chunkId === chunkId);
}

export function formatJinaRankingDebug(
  candidates: SimilarChunk[],
  reranked: RerankedChunk[],
): string {
  const lines = ['Jina ranking', ''];

  if (reranked.length === 0) {
    lines.push('(aucun résultat)');
    return lines.join('\n');
  }

  for (const [rankIndex, result] of reranked.entries()) {
    const candidateIndex = findCandidateIndex(candidates, result.chunkId);
    const score =
      result.rerankScore !== undefined
        ? result.rerankScore.toFixed(4)
        : 'n/a';

    lines.push(
      `#${rankIndex + 1}  index=${candidateIndex}  article=${result.articleNumber}  chunk=${result.chunkId}  score=${score}`,
    );
  }

  return lines.join('\n');
}

export function collectPipelineChunksByArticle(
  candidates: SimilarChunk[],
  reranked: RerankedChunk[],
): Map<string, SimilarChunk> {
  const chunksByArticle = new Map<string, SimilarChunk>();

  for (const chunk of candidates) {
    chunksByArticle.set(chunk.articleNumber, chunk);
  }

  for (const chunk of reranked) {
    chunksByArticle.set(chunk.articleNumber, chunk);
  }

  return chunksByArticle;
}

export function formatArticlesFullContentDebug(
  candidates: SimilarChunk[],
  reranked: RerankedChunk[],
  articleNumbers: readonly string[] = DEFAULT_DEBUG_ARTICLES_OF_INTEREST,
): string {
  const chunksByArticle = collectPipelineChunksByArticle(candidates, reranked);
  const lines = ['Contenu complet (articles d\'intérêt)', ''];

  for (const articleNumber of articleNumbers) {
    const chunk = chunksByArticle.get(articleNumber);

    lines.push(`--- Article ${articleNumber} ---`);

    if (!chunk) {
      lines.push('(absent des résultats du pipeline)');
      lines.push('');
      continue;
    }

    lines.push(`chunk=${chunk.chunkId}`);
    lines.push(chunk.content);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export interface FormatRetrievalDebugReportOptions {
  candidates: SimilarChunk[];
  reranked: RerankedChunk[];
  previewLength?: number;
  articlesOfInterest?: readonly string[];
}

export function formatRetrievalDebugReport(
  options: FormatRetrievalDebugReportOptions,
): string {
  const previewLength =
    options.previewLength ?? DEFAULT_RETRIEVAL_DEBUG_PREVIEW_LENGTH;
  const articlesOfInterest =
    options.articlesOfInterest ?? DEFAULT_DEBUG_ARTICLES_OF_INTEREST;

  return [
    formatVectorSearchDebug(options.candidates, previewLength),
    '',
    formatJinaInputDebug(options.candidates, previewLength),
    '',
    formatJinaRankingDebug(options.candidates, options.reranked),
    '',
    formatArticlesFullContentDebug(
      options.candidates,
      options.reranked,
      articlesOfInterest,
    ),
  ].join('\n');
}
