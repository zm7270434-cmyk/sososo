import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test';

import { useSessionStore } from './sessionStore';

const INITIAL = {
  state: 'idle' as const,
  sessionId: null,
  startedAt: null,
  paused: false,
  pausedAt: null,
  pausedTotalMs: 0,
  error: null,
};

describe('useSessionStore', () => {
  beforeEach(() => {
    // setState shallow-merges, so the action fns (patch/setPaused) are preserved.
    useSessionStore.setState(INITIAL);
  });
  afterEach(() => {
    setSystemTime(); // restore the real clock
  });

  test('patch shallow-merges the given fields', () => {
    useSessionStore.getState().patch({ state: 'recording', sessionId: 7 });
    const s = useSessionStore.getState();
    expect(s.state).toBe('recording');
    expect(s.sessionId).toBe(7);
    expect(s.paused).toBe(false); // untouched
  });

  test('setPaused(true) records the pause start and is idempotent', () => {
    setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const t0 = Date.now();
    useSessionStore.getState().setPaused(true);
    expect(useSessionStore.getState().paused).toBe(true);
    expect(useSessionStore.getState().pausedAt).toBe(t0);

    // Toggling to the same value must not move pausedAt.
    setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
    useSessionStore.getState().setPaused(true);
    expect(useSessionStore.getState().pausedAt).toBe(t0);
  });

  test('resuming accumulates the paused span into pausedTotalMs', () => {
    setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    useSessionStore.getState().setPaused(true);
    setSystemTime(new Date('2026-01-01T00:00:05.000Z')); // 5s paused
    useSessionStore.getState().setPaused(false);

    const s = useSessionStore.getState();
    expect(s.paused).toBe(false);
    expect(s.pausedAt).toBeNull();
    expect(s.pausedTotalMs).toBe(5000);
  });
});
