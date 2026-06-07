import { describe, expect, test } from 'bun:test';

import type { Source, StoredSegment } from '../../../../types/domain';

import { distinctSpeakers } from './speakers';

function seg(source: Source, speaker: string | null): StoredSegment {
  return { segmentId: 's', source, speaker, text: 'x', tStart: 0 };
}

describe('distinctSpeakers', () => {
  test('groups lines by stored label in first-appearance order with counts', () => {
    const out = distinctSpeakers([
      seg('remote', 'Speaker 1'),
      seg('remote', 'Speaker 2'),
      seg('remote', 'Speaker 1'),
    ]);
    expect(out.map((s) => s.display)).toEqual(['Speaker 1', 'Speaker 2']);
    expect(out[0].count).toBe(2);
    expect(out[1].count).toBe(1);
  });

  test('groups all un-diarized (null-speaker) lines together under the first occurrence', () => {
    const out = distinctSpeakers([seg('you', null), seg('remote', null)]);
    expect(out).toHaveLength(1);
    expect(out[0].stored).toBeNull();
    expect(out[0].display).toBe('You'); // first un-diarized line was a "you" line
    expect(out[0].count).toBe(2);
  });

  test('a lone un-diarized remote line becomes the "Speaker" group', () => {
    const out = distinctSpeakers([seg('remote', null)]);
    expect(out[0].display).toBe('Speaker');
    expect(out[0].source).toBe('remote');
  });
});
