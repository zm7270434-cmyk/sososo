/** Best-effort host-OS detection for the renderer. Used only for cosmetic
 *  platform differences (window-chrome layout, copy) — not for behavior. Falls
 *  back to `false` outside a browser/webview so plain `vite dev` and Windows
 *  both keep the custom titlebar. */
function detectMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  // WKWebView (Tauri on macOS) reports "Macintosh; Intel Mac OS X" in the UA and
  // "MacIntel" in platform; Windows reports "Win32".
  return /Mac/i.test(platform) || /Mac OS X|Macintosh/i.test(ua);
}

/** True when the app is running on macOS. */
export const isMacOS = detectMacOS();

function detectLinux(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  // WebKitGTK (Tauri on Linux) reports e.g. "X11; Linux x86_64" in the UA and
  // "Linux x86_64" in platform. Android's UA also says "Linux", so exclude it.
  if (/Android/i.test(ua)) return false;
  return /Linux/i.test(platform) || /Linux/i.test(ua);
}

/** True when the app is running on Linux (excludes Android). */
export const isLinux = detectLinux();
