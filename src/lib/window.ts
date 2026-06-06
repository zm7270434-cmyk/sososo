import { getCurrentWindow } from "@tauri-apps/api/window";

/** Thin wrappers around the current window. Each guards against running outside
 * a Tauri webview (e.g. plain `vite dev` in a browser) so handlers never throw. */

export async function closeSelf(): Promise<void> {
  try {
    await getCurrentWindow().close();
  } catch (e) {
    console.warn("closeSelf failed (not in Tauri?)", e);
  }
}

export async function minimizeSelf(): Promise<void> {
  try {
    await getCurrentWindow().minimize();
  } catch (e) {
    console.warn("minimizeSelf failed (not in Tauri?)", e);
  }
}

export async function setAlwaysOnTop(value: boolean): Promise<void> {
  try {
    await getCurrentWindow().setAlwaysOnTop(value);
  } catch (e) {
    console.warn("setAlwaysOnTop failed (not in Tauri?)", e);
  }
}

export async function startDragging(): Promise<void> {
  try {
    await getCurrentWindow().startDragging();
  } catch (e) {
    console.warn("startDragging failed (not in Tauri?)", e);
  }
}
