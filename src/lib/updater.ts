import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useUpdateStore } from '../state/updateStore';

/**
 * In-app auto-update, driven from the frontend via the updater JS plugin
 * (mirrors how `AboutRoute` calls `getVersion()` directly). The Rust side only
 * registers the updater + process plugins; everything below talks to GitHub
 * Releases through `tauri.conf.json`'s `plugins.updater` endpoint. Each function
 * reflects progress into `updateStore`, which `UpdateBanner` + Settings render.
 */

/** The update returned by the most recent successful check, reused by the
 *  download step so the UI can check first and install on a later click. */
let pending: Update | null = null;

/** Guards the once-per-session launch check (also dodges React StrictMode's
 *  double-mount in dev). */
let launchChecked = false;

/** Check GitHub Releases for a newer version and reflect the result in the
 *  store. `silent` (used at launch) stays quiet on failure — being offline or
 *  running outside a Tauri webview shouldn't surface an error to the user. */
export async function checkForUpdate(opts?: { silent?: boolean }): Promise<void> {
  const { patch } = useUpdateStore.getState();
  patch({ status: 'checking', error: null });
  try {
    const update = await check();
    if (update) {
      pending = update;
      patch({ status: 'available', version: update.version, notes: update.body ?? null });
    } else {
      pending = null;
      patch({ status: 'uptodate' });
    }
  } catch (e) {
    pending = null;
    if (opts?.silent) {
      patch({ status: 'idle' });
    } else {
      patch({ status: 'error', error: String(e) });
    }
  }
}

/** Run the silent update check once, on first app launch. */
export async function checkOnLaunch(): Promise<void> {
  if (launchChecked) return;
  launchChecked = true;
  await checkForUpdate({ silent: true });
}

/** Download + install the pending update, streaming progress into the store. On
 *  success the new version is installed but not yet running (status 'ready') —
 *  call `restartApp()` to apply it. */
export async function downloadAndInstall(): Promise<void> {
  const { patch } = useUpdateStore.getState();
  if (!pending) {
    // The UI raced ahead of a check (or the handle was already consumed) —
    // re-check so we have a fresh update to install.
    await checkForUpdate();
    if (!pending) return;
  }
  patch({ status: 'downloading', downloaded: 0, contentLength: null, error: null });
  try {
    await pending.downloadAndInstall((ev) => {
      switch (ev.event) {
        case 'Started':
          patch({ contentLength: ev.data.contentLength ?? null, downloaded: 0 });
          break;
        case 'Progress':
          patch({ downloaded: useUpdateStore.getState().downloaded + ev.data.chunkLength });
          break;
        case 'Finished':
          break;
      }
    });
    patch({ status: 'ready' });
  } catch (e) {
    patch({ status: 'error', error: String(e) });
  }
}

/** Relaunch the app to apply an installed update. No-op outside a Tauri webview. */
export async function restartApp(): Promise<void> {
  try {
    await relaunch();
  } catch (e) {
    console.warn('relaunch failed (not in Tauri?)', e);
  }
}
