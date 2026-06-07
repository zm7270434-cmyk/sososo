import { describe, expect, test } from 'bun:test';

import { speakerColor } from './speaker';

/** Mirror of the values in speaker.ts so the test pins the contract, not the impl. */
const YOU_COLOR = '#6ea8fe';
const PALETTE = [
  '#b794f6',
  '#5fd1a8',
  '#f6c177',
  '#f78fb3',
  '#56cfe1',
  '#c3e88d',
  '#ff9e64',
  '#9d8cff',
];

describe('speakerColor', () => {
  test("returns the accent blue for the user's own voice, ignoring any speaker label", () => {
    expect(speakerColor('you')).toBe(YOU_COLOR);
    expect(speakerColor('you', 'Speaker 3')).toBe(YOU_COLOR);
  });

  test('maps numbered remote speakers to distinct palette slots (1-based label → 0-based slot)', () => {
    expect(speakerColor('remote', 'Speaker 1')).toBe(PALETTE[0]);
    expect(speakerColor('remote', 'Speaker 2')).toBe(PALETTE[1]);
  });

  test('cycles through the palette for speakers beyond its length', () => {
    // Palette has 8 entries: "Speaker 9" → slot 8 → wraps back to slot 0.
    expect(speakerColor('remote', 'Speaker 9')).toBe(PALETTE[0]);
  });

  test('falls back to slot 0 when a remote speaker label is missing', () => {
    expect(speakerColor('remote')).toBe(PALETTE[0]);
    expect(speakerColor('remote', null)).toBe(PALETTE[0]);
  });

  test('gives a non-numeric speaker label a stable color drawn from the palette', () => {
    const first = speakerColor('remote', 'Alice');
    const second = speakerColor('remote', 'Alice');
    expect(first).toBe(second);
    expect(PALETTE).toContain(first);
  });
});
