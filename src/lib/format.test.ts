import { describe, expect, test } from 'bun:test';

import { formatDateTime } from './format';

describe('formatDateTime', () => {
  test('returns the input unchanged when the string is not a valid date', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
    expect(formatDateTime('')).toBe('');
  });

  test('formats a valid ISO timestamp into an en-US date string', () => {
    // Midday, mid-month UTC: the date/month/year stay stable across every real
    // timezone offset (UTC-12..+14), so these assertions are not TZ-dependent.
    const out = formatDateTime('2026-06-15T12:00:00Z');
    expect(out).not.toBe('2026-06-15T12:00:00Z');
    expect(out).toContain('2026');
    expect(out).toContain('Jun');
    expect(out).toMatch(/\b(AM|PM)\b/);
  });
});
