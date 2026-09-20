import { EvaluationError } from './evaluation.error.js';
import type { E2ESourceSnapshot } from './e2e-evaluation.types.js';
import type { E2ESourceJudgeSourceInput } from './e2e-source-judge.types.js';

const SOURCE_HEADER_LINE_PATTERN =
  /^\[Source (\d+) — (.+?) — Article (.+?) — chunk (\d+)\]$/;

export interface ParsedContextSourceBlock {
  sourceId: number;
  codeName: string;
  articleNumber: string;
  chunkIndex: number;
  content: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSourceHeaderLinePattern(
  source: Pick<E2ESourceSnapshot, 'sourceId' | 'articleNumber' | 'chunkIndex'>,
): RegExp {
  return new RegExp(
    `^\\[Source ${source.sourceId} — .+? — Article ${escapeRegExp(source.articleNumber)} — chunk ${source.chunkIndex}\\]$`,
  );
}

function findSourceHeaderLine(
  context: string,
  source: E2ESourceSnapshot,
  searchFrom = 0,
): { header: string; headerIndex: number } {
  const pattern = buildSourceHeaderLinePattern(source);
  const lines = context.split('\n');
  let offset = 0;

  for (const line of lines) {
    if (offset >= searchFrom && pattern.test(line)) {
      return { header: line, headerIndex: offset };
    }
    offset += line.length + 1;
  }

  throw new EvaluationError(
    `Missing source block for sourceId ${source.sourceId}`,
    'SOURCE_CONTEXT_INVALID',
  );
}

function findSourceBlockContent(
  context: string,
  source: E2ESourceSnapshot,
  nextSource: E2ESourceSnapshot | undefined,
): string {
  const { header, headerIndex } = findSourceHeaderLine(context, source);
  const bodyStart = headerIndex + header.length;
  if (context[bodyStart] !== '\n') {
    throw new EvaluationError(
      `Invalid source block for sourceId ${source.sourceId}`,
      'SOURCE_CONTEXT_INVALID',
    );
  }

  let bodyEnd = context.length;
  if (nextSource) {
    const { headerIndex: nextHeaderIndex } = findSourceHeaderLine(
      context,
      nextSource,
      bodyStart + 1,
    );
    bodyEnd = nextHeaderIndex;
  }

  const content = context.slice(bodyStart + 1, bodyEnd).replace(/\n+$/u, '').trimEnd();
  if (content.length === 0) {
    throw new EvaluationError(
      `Invalid source content for sourceId ${source.sourceId}`,
      'SOURCE_CONTEXT_INVALID',
    );
  }

  return content;
}

export function parseContextSourceBlocks(context: string): ParsedContextSourceBlock[] {
  const lines = context.split('\n');
  const blocks: ParsedContextSourceBlock[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? '';
    const headerMatch = line.match(SOURCE_HEADER_LINE_PATTERN);
    if (!headerMatch) {
      continue;
    }

    const sourceId = Number(headerMatch[1]);
    const codeName = headerMatch[2] ?? '';
    const articleNumber = headerMatch[3] ?? '';
    const chunkIndex = Number(headerMatch[4]);
    const contentLines: string[] = [];

    for (lineIndex += 1; lineIndex < lines.length; lineIndex += 1) {
      const contentLine = lines[lineIndex] ?? '';
      if (SOURCE_HEADER_LINE_PATTERN.test(contentLine)) {
        lineIndex -= 1;
        break;
      }
      contentLines.push(contentLine);
    }

    blocks.push({
      sourceId,
      codeName,
      articleNumber,
      chunkIndex,
      content: contentLines.join('\n').trimEnd(),
    });
  }

  return blocks;
}

export function extractE2ESourcesFromContext(
  context: string,
  sources: E2ESourceSnapshot[],
  questionId?: string,
): E2ESourceJudgeSourceInput[] {
  if (sources.length === 0) {
    return [];
  }

  const orderedSources = [...sources].sort((left, right) => left.sourceId - right.sourceId);

  return orderedSources.map((source, index) => {
    const content = findSourceBlockContent(
      context,
      source,
      orderedSources[index + 1],
    );

    return {
      sourceId: source.sourceId,
      chunkId: source.chunkId,
      articleNumber: source.articleNumber,
      content,
    };
  });
}
