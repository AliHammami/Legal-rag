import { EvaluationError } from './evaluation.error.js';
import type { E2ESourceSnapshot } from './e2e-evaluation.types.js';
import type { E2ESourceJudgeSourceInput } from './e2e-source-judge.types.js';

const SOURCE_BLOCK_PATTERN =
  /\[Source (\d+) — Article ([\d\w.-]+) — chunk (\d+)\]\n([\s\S]*?)(?=\n\n\[Source \d+ — Article |$)/g;

export interface ParsedContextSourceBlock {
  sourceId: number;
  articleNumber: string;
  chunkIndex: number;
  content: string;
}

export function parseContextSourceBlocks(context: string): ParsedContextSourceBlock[] {
  const blocks: ParsedContextSourceBlock[] = [];
  const pattern = new RegExp(SOURCE_BLOCK_PATTERN.source, 'g');

  for (const match of context.matchAll(pattern)) {
    const sourceId = Number(match[1]);
    const articleNumber = match[2];
    const chunkIndex = Number(match[3]);
    const content = match[4]?.trim() ?? '';

    if (!Number.isInteger(sourceId) || sourceId < 1) {
      throw new EvaluationError(
        `Invalid source block in context: sourceId=${String(match[1])}`,
        'SOURCE_CONTEXT_INVALID',
      );
    }

    blocks.push({
      sourceId,
      articleNumber,
      chunkIndex,
      content,
    });
  }

  return blocks;
}

export function extractE2ESourcesFromContext(
  context: string,
  sources: E2ESourceSnapshot[],
  questionId?: string,
): E2ESourceJudgeSourceInput[] {
  const suffix = questionId ? ` for question ${questionId}` : '';
  const blocks = parseContextSourceBlocks(context);

  if (blocks.length === 0 && sources.length > 0) {
    throw new EvaluationError(
      `Unable to extract source content from context${suffix}`,
      'SOURCE_CONTEXT_INVALID',
    );
  }

  if (blocks.length !== sources.length) {
    throw new EvaluationError(
      `Source count mismatch${suffix}: context has ${blocks.length}, snapshot has ${sources.length}`,
      'SOURCE_CONTEXT_INVALID',
    );
  }

  const blocksBySourceId = new Map(
    blocks.map((block) => [block.sourceId, block]),
  );

  return sources.map((source) => {
    const block = blocksBySourceId.get(source.sourceId);
    if (!block) {
      throw new EvaluationError(
        `Missing source block for sourceId ${source.sourceId}${suffix}`,
        'SOURCE_CONTEXT_INVALID',
      );
    }

    if (block.chunkIndex !== source.chunkIndex) {
      throw new EvaluationError(
        `Chunk index mismatch for sourceId ${source.sourceId}${suffix}`,
        'SOURCE_CONTEXT_INVALID',
      );
    }

    if (
      block.articleNumber !== source.articleNumber ||
      block.content.length === 0
    ) {
      throw new EvaluationError(
        `Invalid source content for sourceId ${source.sourceId}${suffix}`,
        'SOURCE_CONTEXT_INVALID',
      );
    }

    return {
      sourceId: source.sourceId,
      chunkId: source.chunkId,
      articleNumber: source.articleNumber,
      content: block.content,
    };
  });
}
