import { describe, expect, it } from 'vitest';

import {
  detectMulticorpusDuplicates,
  mergeDuplicateGroups,
} from '../detect-multicorpus-duplicates.js';
import { FIXTURE_MULTICORPUS_QUESTIONS } from './fixtures/multicorpus-dataset.fixture.js';

describe('detectMulticorpusDuplicates', () => {
  it('detects identical normalized questions', () => {
    const duplicate = {
      ...FIXTURE_MULTICORPUS_QUESTIONS[0]!,
      id: 'q999',
      question: '  Quelles sont les conditions de la légitime défense ? ',
    };

    const groups = detectMulticorpusDuplicates([
      FIXTURE_MULTICORPUS_QUESTIONS[0]!,
      duplicate,
    ]);

    expect(groups.length).toBeGreaterThan(0);
    expect(mergeDuplicateGroups(groups)[0]?.questionIds).toContain('q001');
  });

  it('returns no duplicate groups for distinct fixture questions', () => {
    const groups = detectMulticorpusDuplicates(FIXTURE_MULTICORPUS_QUESTIONS);
    expect(mergeDuplicateGroups(groups)).toEqual([]);
  });
});
