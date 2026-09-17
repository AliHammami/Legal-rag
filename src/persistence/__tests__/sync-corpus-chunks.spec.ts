import { describe, expect, it } from 'vitest';

import { findObsoleteChunkIds } from '../sync-corpus-chunks.js';

describe('findObsoleteChunkIds', () => {
  it('identifie les chunkIds absents du fichier source', () => {
    expect(
      findObsoleteChunkIds(
        ['111-1#0', '131-26-2#0', '131-26-2#1'],
        ['111-1#0', '131-26-2#0'],
      ),
    ).toEqual(['131-26-2#1']);
  });

  it('retourne une liste vide si la source est identique', () => {
    expect(
      findObsoleteChunkIds(['111-1#0', '111-2#0'], ['111-1#0', '111-2#0']),
    ).toEqual([]);
  });

  it('retourne tous les existants si la source est vide', () => {
    expect(findObsoleteChunkIds(['111-1#0', '111-2#0'], [])).toEqual([
      '111-1#0',
      '111-2#0',
    ]);
  });
});
