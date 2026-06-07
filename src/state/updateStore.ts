import { create } from 'zustand';

/** Where the in-app updater is in its check → download → install → restart flow. */
export type UpdateStatus =
  | 'idle' // not checked yet, or a silent launch check found nothing / failed quietly
  | 'checking' // a check is in flight
  | 'available' // an update was found and is ready to download
  | 'downloading' // downloading + installing the update
  | 'ready' // installed; the app must restart to apply it
  | 'uptodate' // checked and already on the latest version
  | 'error'; // a check or download failed

interface UpdateStore {
  status: UpdateStatus;
  /** Version offered by the update (null until one is found). */
  version: string | null;
  /** Release notes for the available update, if the manifest carries any. */
  notes: string | null;
  /** Bytes downloaded so far during 'downloading'. */
  downloaded: number;
  /** Total download size in bytes, or null when the server omits it. */
  contentLength: number | null;
  error: string | null;
  patch: (p: Partial<Omit<UpdateStore, 'patch' | 'reset'>>) => void;
  reset: () => void;
}

const INITIAL = {
  status: 'idle' as UpdateStatus,
  version: null,
  notes: null,
  downloaded: 0,
  contentLength: null,
  error: null,
};

/** Runtime-only (not persisted): the update flow restarts fresh each launch. */
export const useUpdateStore = create<UpdateStore>((set) => ({
  ...INITIAL,
  patch: (p) => set(p),
  reset: () => set(INITIAL),
}));
