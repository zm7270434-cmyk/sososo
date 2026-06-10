import type { WindowInfo } from '../types/domain';

/** "chrome.exe" → "Chrome": drop the trailing .exe (any case) and uppercase the
 *  first letter, leaving the rest of the casing as the process named itself. */
export function prettyAppName(app: string): string {
  const base = app.replace(/\.exe$/i, '');
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
}

/** Case-insensitive substring filter over a window's title, raw process name,
 *  and prettified app name. An empty/whitespace query keeps everything. */
export function filterWindows(windows: WindowInfo[], query: string): WindowInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return windows;
  return windows.filter(
    (w) =>
      w.title.toLowerCase().includes(q) ||
      w.app.toLowerCase().includes(q) ||
      prettyAppName(w.app).toLowerCase().includes(q),
  );
}
