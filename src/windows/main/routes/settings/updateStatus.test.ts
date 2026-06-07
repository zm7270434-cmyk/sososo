import { describe, expect, test } from 'bun:test';

import { deriveUpdateStatus } from './updateStatus';

describe('deriveUpdateStatus', () => {
  test('reports the up-to-date and available states', () => {
    expect(deriveUpdateStatus('uptodate', null, 0, null, null)).toEqual({
      msg: "You're on the latest version.",
      warn: false,
    });
    expect(deriveUpdateStatus('available', '1.2.3', 0, null, null).msg).toBe(
      'Version 1.2.3 is available.',
    );
  });

  test('shows a download percentage only when the total size is known', () => {
    expect(deriveUpdateStatus('downloading', null, 50, 100, null).msg).toBe('Downloading… 50%');
    expect(deriveUpdateStatus('downloading', null, 50, null, null).msg).toBe('Downloading…');
  });

  test('flags the error state as a warning with the error detail', () => {
    const out = deriveUpdateStatus('error', null, 0, null, 'boom');
    expect(out.warn).toBe(true);
    expect(out.msg).toBe('Update check failed: boom');
  });

  test('renders nothing for idle/checking states', () => {
    expect(deriveUpdateStatus('idle', null, 0, null, null).msg).toBe('');
    expect(deriveUpdateStatus('checking', null, 0, null, null).msg).toBe('');
  });
});
