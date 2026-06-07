import type { UpdateStatus } from '../../../../state/updateStore';

export interface DerivedUpdateStatus {
  /** Human-readable status line ('' when there is nothing to show). */
  msg: string;
  /** Whether the message should be styled as a warning (error state). */
  warn: boolean;
}

/** Derive the App-update status line shown in Settings from the updater store
 *  fields. Pure: the same inputs always map to the same message. */
export function deriveUpdateStatus(
  status: UpdateStatus,
  version: string | null,
  downloaded: number,
  contentLength: number | null,
  error: string | null,
): DerivedUpdateStatus {
  const pct =
    contentLength && contentLength > 0
      ? Math.min(100, Math.round((downloaded / contentLength) * 100))
      : null;
  switch (status) {
    case 'uptodate':
      return { msg: "You're on the latest version.", warn: false };
    case 'available':
      return { msg: `Version ${version ?? ''} is available.`, warn: false };
    case 'downloading':
      return { msg: `Downloading…${pct != null ? ` ${pct}%` : ''}`, warn: false };
    case 'ready':
      return { msg: 'Update installed — restart to finish.', warn: false };
    case 'error':
      return { msg: `Update check failed: ${error ?? 'unknown error'}`, warn: true };
    default:
      return { msg: '', warn: false };
  }
}
