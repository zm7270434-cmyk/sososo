import { describe, expect, test } from 'bun:test';

import { LANGUAGES, SUMMARY_LANGUAGES, TRANSLATE_TARGETS, languageLabel } from './languages';

describe('languageLabel', () => {
  test('returns the display label for a known code', () => {
    expect(languageLabel('id')).toBe('Indonesian');
    expect(languageLabel('multi')).toBe('Auto-detect (multilingual)');
  });

  test('falls back to the code itself for an unknown code', () => {
    expect(languageLabel('xx-YY')).toBe('xx-YY');
  });
});

describe('language lists', () => {
  test('TRANSLATE_TARGETS drops the multilingual pseudo-language', () => {
    expect(TRANSLATE_TARGETS.some((l) => l.code === 'multi')).toBe(false);
    expect(TRANSLATE_TARGETS).toHaveLength(LANGUAGES.length - 1);
  });

  test('SUMMARY_LANGUAGES leads with "auto" and excludes multi', () => {
    expect(SUMMARY_LANGUAGES[0].code).toBe('auto');
    expect(SUMMARY_LANGUAGES.some((l) => l.code === 'multi')).toBe(false);
    expect(SUMMARY_LANGUAGES).toHaveLength(TRANSLATE_TARGETS.length + 1);
  });

  test('language codes are unique', () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
