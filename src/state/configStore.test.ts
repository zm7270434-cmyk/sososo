import { beforeEach, describe, expect, test } from 'bun:test';

// The config store persists via zustand's `persist`, whose default storage is
// `window.localStorage`; bun's test env has no DOM, so back it with an in-memory
// stub BEFORE the store module is imported (hence the dynamic import below) or
// zustand would warn and skip persistence.
const backing = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
  clear: () => backing.clear(),
  key: (i: number) => [...backing.keys()][i] ?? null,
  get length() {
    return backing.size;
  },
} as Storage;
globalThis.localStorage = localStorageStub;
(globalThis as { window?: unknown }).window ??= { localStorage: localStorageStub };

const { useConfigStore } = await import('./configStore');

// Snapshot of the store as shipped (defaults + actions), taken before any test
// mutates it, so each test starts from the real initial state.
const initial = useConfigStore.getState();

describe('useConfigStore — behavior prefs', () => {
  beforeEach(() => {
    useConfigStore.setState(initial, true);
  });

  test('closeToTray defaults to on', () => {
    expect(useConfigStore.getState().closeToTray).toBe(true);
  });

  test('setCloseToTray updates and persists the choice', () => {
    useConfigStore.getState().setCloseToTray(false);
    expect(useConfigStore.getState().closeToTray).toBe(false);

    const persisted = JSON.parse(localStorage.getItem('sososo-config') ?? '{}');
    expect(persisted.state.closeToTray).toBe(false);
  });

  test('globalShortcutEnabled defaults to on', () => {
    expect(useConfigStore.getState().globalShortcutEnabled).toBe(true);
  });

  test('setGlobalShortcutEnabled updates and persists the choice', () => {
    useConfigStore.getState().setGlobalShortcutEnabled(false);
    expect(useConfigStore.getState().globalShortcutEnabled).toBe(false);

    const persisted = JSON.parse(localStorage.getItem('sososo-config') ?? '{}');
    expect(persisted.state.globalShortcutEnabled).toBe(false);
  });
});
