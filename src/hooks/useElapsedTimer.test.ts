import { describe, expect, test } from 'bun:test';

import { formatElapsed } from './useElapsedTimer';

describe('formatElapsed', () => {
  test('formats a second count as zero-padded HH:MM:SS', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
    expect(formatElapsed(5)).toBe('00:00:05');
    expect(formatElapsed(65)).toBe('00:01:05');
    expect(formatElapsed(3661)).toBe('01:01:01');
  });

  test('does not cap the hours field', () => {
    expect(formatElapsed(360000)).toBe('100:00:00');
  });
});
