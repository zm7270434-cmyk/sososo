import { describe, expect, test } from 'bun:test';
import { isValidElement, type ReactElement } from 'react';

import { highlightText } from './highlightText';

describe('highlightText', () => {
  test('returns the text unchanged when the query is empty, blank, or absent', () => {
    expect(highlightText('hello world', '')).toBe('hello world');
    expect(highlightText('hello world', '   ')).toBe('hello world');
    expect(highlightText('hello world', 'xyz')).toBe('hello world');
  });

  test('wraps each case-insensitive match in a <mark>, preserving the original case', () => {
    const out = highlightText('Foo foo', 'foo');
    expect(Array.isArray(out)).toBe(true);

    const marks = (out as unknown[]).filter((n): n is ReactElement => isValidElement(n));
    expect(marks).toHaveLength(2);
    expect((marks[0].props as { children: string }).children).toBe('Foo');
    expect((marks[1].props as { children: string }).children).toBe('foo');
  });
});
