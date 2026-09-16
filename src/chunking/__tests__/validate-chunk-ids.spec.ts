import { describe, expect, it } from 'vitest';

import {
  assertUniqueChunkIds,
  findDuplicateChunkIds,
} from '../validate-chunk-ids.js';

describe('validate-chunk-ids', () => {
  it('detecte les chunkId dupliques', () => {
    expect(
      findDuplicateChunkIds([
        { chunkId: '2@p2999#0' },
        { chunkId: '111-1#0' },
        { chunkId: '2@p2999#0' },
      ]),
    ).toEqual(['2@p2999#0']);
  });

  it('assertUniqueChunkIds echoue si des doublons existent', () => {
    expect(() =>
      assertUniqueChunkIds(
        [{ chunkId: '2@p2999#0' }, { chunkId: '2@p2999#0' }],
        'code-du-travail',
      ),
    ).toThrow(/Duplicate chunkId/);
  });
});
