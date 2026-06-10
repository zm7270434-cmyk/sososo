import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';

/** Thin wrappers around the current window. Each guards against running outside
 * a Tauri webview (e.g. plain `vite dev` in a browser) so handlers never throw. */

const RECORDING_SIZE = new LogicalSize(460, 600);
const NORMAL_SIZE = new LogicalSize(1040, 720);

/** Shrink to a compact, always-on-top floating widget for the recording view.
 *  The window has no native shadow (see tauri.conf.json `shadow: false`), so the
 *  transparent gaps don't read as one enclosing box — the pill and panel float
 *  as separate shapes. */
export async function enterRecordingWindow(): Promise<void> {
  try {
    const w = getCurrentWindow();
    await w.setSize(RECORDING_SIZE);
    await w.center();
    await w.setAlwaysOnTop(true);
  } catch (e) {
    console.warn('enterRecordingWindow failed (not in Tauri?)', e);
  }
}

/** Restore the full main-window size when leaving the recording view. */
export async function exitRecordingWindow(): Promise<void> {
  try {
    const w = getCurrentWindow();
    await w.setAlwaysOnTop(false);
    await w.setSize(NORMAL_SIZE);
    await w.center();
  } catch (e) {
    console.warn('exitRecordingWindow failed (not in Tauri?)', e);
  }
}

export async function closeSelf(): Promise<void> {
  try {
    await getCurrentWindow().close();
  } catch (e) {
    console.warn('closeSelf failed (not in Tauri?)', e);
  }
}

export async function minimizeSelf(): Promise<void> {
  try {
    await getCurrentWindow().minimize();
  } catch (e) {
    console.warn('minimizeSelf failed (not in Tauri?)', e);
  }
}

/** Toggle between maximized and the previous (restored) window size. */
export async function toggleMaximizeSelf(): Promise<void> {
  try {
    await getCurrentWindow().toggleMaximize();
  } catch (e) {
    console.warn('toggleMaximizeSelf failed (not in Tauri?)', e);
  }
}

/** Whether the window is currently maximized (false outside a Tauri webview). */
export async function isMaximizedSelf(): Promise<boolean> {
  try {
    return await getCurrentWindow().isMaximized();
  } catch (e) {
    console.warn('isMaximizedSelf failed (not in Tauri?)', e);
    return false;
  }
}

/** Subscribe to window resize events so the UI can keep its maximize/restore
 *  state in sync (the window can also be maximized via OS gestures). Returns an
 *  unlisten function — a no-op outside a Tauri webview. */
export async function onWindowResized(cb: () => void): Promise<() => void> {
  try {
    return await getCurrentWindow().onResized(() => cb());
  } catch (e) {
    console.warn('onWindowResized failed (not in Tauri?)', e);
    return () => {};
  }
}

/** Subscribe to the native window gaining focus (fires even when the DOM
 *  `focus` event doesn't, e.g. focus returning to the window frame). Returns an
 *  unlisten function — a no-op outside a Tauri webview. */
export async function onWindowFocused(cb: () => void): Promise<() => void> {
  try {
    return await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) cb();
    });
  } catch (e) {
    console.warn('onWindowFocused failed (not in Tauri?)', e);
    return () => {};
  }
}

export async function setAlwaysOnTop(value: boolean): Promise<void> {
  try {
    await getCurrentWindow().setAlwaysOnTop(value);
  } catch (e) {
    console.warn('setAlwaysOnTop failed (not in Tauri?)', e);
  }
}

export async function startDragging(): Promise<void> {
  try {
    await getCurrentWindow().startDragging();
  } catch (e) {
    console.warn('startDragging failed (not in Tauri?)', e);
  }
}
