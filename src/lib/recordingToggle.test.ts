import { describe, expect, test } from 'bun:test';

import { toggleActionFor } from './recordingToggle';

describe('toggleActionFor', () => {
  test('starts from every settled non-recording state', () => {
    expect(toggleActionFor('idle')).toBe('start');
    expect(toggleActionFor('stopped')).toBe('start');
    expect(toggleActionFor('error')).toBe('start');
  });

  test('stops while a session is live (including during a reconnect)', () => {
    expect(toggleActionFor('recording')).toBe('stop');
    expect(toggleActionFor('reconnecting')).toBe('stop');
  });

  test('ignores the toggle mid-transition (no double start/stop)', () => {
    expect(toggleActionFor('starting')).toBe('ignore');
    expect(toggleActionFor('stopping')).toBe('ignore');
  });
});
