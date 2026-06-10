import { describe, expect, test } from 'bun:test';

import { filterWindows, prettyAppName } from './windowPicker';
import type { WindowInfo } from '../types/domain';

const WINDOWS: WindowInfo[] = [
  { id: '1', title: 'Weekly sync - Zoom', app: 'Zoom.exe' },
  { id: '2', title: 'Daily standup | Microsoft Teams', app: 'ms-teams.exe' },
  { id: '3', title: 'Meet - Google Chrome', app: 'chrome.exe' },
  { id: '4', title: 'main.rs - sososo - Visual Studio Code', app: 'Code.exe' },
];

describe('filterWindows', () => {
  test('returns all windows for an empty or whitespace-only query', () => {
    expect(filterWindows(WINDOWS, '')).toEqual(WINDOWS);
    expect(filterWindows(WINDOWS, '   ')).toEqual(WINDOWS);
  });

  test('matches the window title case-insensitively', () => {
    expect(filterWindows(WINDOWS, 'weekly').map((w) => w.id)).toEqual(['1']);
    expect(filterWindows(WINDOWS, 'MEET').map((w) => w.id)).toEqual(['3']);
  });

  test('matches the app/process name case-insensitively', () => {
    expect(filterWindows(WINDOWS, 'zoom').map((w) => w.id)).toEqual(['1']);
    expect(filterWindows(WINDOWS, 'code').map((w) => w.id)).toEqual(['4']);
  });

  test('matches the prettified app name (no .exe needed in the query)', () => {
    expect(filterWindows(WINDOWS, 'teams').map((w) => w.id)).toEqual(['2']);
  });

  test('returns an empty list when nothing matches', () => {
    expect(filterWindows(WINDOWS, 'spotify')).toEqual([]);
  });
});

describe('prettyAppName', () => {
  test('strips the .exe suffix case-insensitively and capitalizes the first letter', () => {
    expect(prettyAppName('chrome.exe')).toBe('Chrome');
    expect(prettyAppName('Zoom.exe')).toBe('Zoom');
    expect(prettyAppName('EXCEL.EXE')).toBe('EXCEL');
  });

  test('keeps inner casing untouched (only the first letter is uppercased)', () => {
    expect(prettyAppName('ms-teams.exe')).toBe('Ms-teams');
    expect(prettyAppName('Code.exe')).toBe('Code');
  });

  test('handles names without .exe and empty input', () => {
    expect(prettyAppName('firefox')).toBe('Firefox');
    expect(prettyAppName('')).toBe('');
  });
});
