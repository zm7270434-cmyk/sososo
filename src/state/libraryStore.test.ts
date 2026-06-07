import { beforeEach, describe, expect, test } from 'bun:test';

import { useLibraryStore } from './libraryStore';

describe('useLibraryStore', () => {
  beforeEach(() => {
    useLibraryStore.setState({ revision: 0 });
  });

  test('refresh increments the revision counter', () => {
    expect(useLibraryStore.getState().revision).toBe(0);
    useLibraryStore.getState().refresh();
    useLibraryStore.getState().refresh();
    expect(useLibraryStore.getState().revision).toBe(2);
  });
});
