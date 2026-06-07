import { beforeEach, describe, expect, test } from 'bun:test';

import { useUpdateStore } from './updateStore';

describe('useUpdateStore', () => {
  beforeEach(() => {
    useUpdateStore.getState().reset();
  });

  test('patch merges partial fields', () => {
    useUpdateStore.getState().patch({ status: 'available', version: '1.2.3' });
    const s = useUpdateStore.getState();
    expect(s.status).toBe('available');
    expect(s.version).toBe('1.2.3');
  });

  test('reset restores the initial idle state', () => {
    useUpdateStore.getState().patch({
      status: 'downloading',
      downloaded: 500,
      contentLength: 1000,
      version: '9.9.9',
      error: 'boom',
    });

    useUpdateStore.getState().reset();

    const s = useUpdateStore.getState();
    expect(s.status).toBe('idle');
    expect(s.version).toBeNull();
    expect(s.notes).toBeNull();
    expect(s.downloaded).toBe(0);
    expect(s.contentLength).toBeNull();
    expect(s.error).toBeNull();
  });
});
