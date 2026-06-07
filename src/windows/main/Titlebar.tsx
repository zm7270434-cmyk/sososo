import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  closeSelf,
  minimizeSelf,
  toggleMaximizeSelf,
  isMaximizedSelf,
  onWindowResized,
} from '../../lib/window';
import { IconClose, IconMinimize } from '../../lib/icons';
import { isMacOS } from '../../lib/platform';

const ICON_BTN =
  'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm bg-transparent text-[14px] leading-none text-fg-dim transition-colors duration-[120ms] active:bg-active';

// Window maximize/restore glyphs drawn inline — the Hugeicons square/copy icons
// turn into an unreadable blob at this size, so we use crisp custom SVGs that
// read clearly as a single square (maximize) and two stacked squares (restore).
function MaximizeGlyph() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden={true}
    >
      <rect x={3} y={3} width={10} height={10} rx={1.6} />
    </svg>
  );
}

function RestoreGlyph() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
      aria-hidden={true}
    >
      <rect x={2.5} y={5.5} width={8} height={8} rx={1.6} />
      <path d="M5.5 5.5V4A1.5 1.5 0 0 1 7 2.5h5A1.5 1.5 0 0 1 13.5 4v5a1.5 1.5 0 0 1-1.5 1.5h-1.5" />
    </svg>
  );
}

export default function Titlebar() {
  const [maximized, setMaximized] = useState(false);

  // Keep the maximize/restore icon in sync with the real window state — the
  // window can also be (un)maximized via OS gestures (double-click the drag
  // region, Win+Up), not only through our button. macOS uses native controls,
  // so this only matters on Windows/Linux.
  useEffect(() => {
    if (isMacOS) return;
    let unlisten = () => {};
    void isMaximizedSelf().then(setMaximized);
    void onWindowResized(() => {
      void isMaximizedSelf().then(setMaximized);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten();
  }, []);

  return (
    <header
      // On macOS the window uses native traffic lights (titleBarStyle "Overlay"),
      // so we drop the custom min/close buttons and pad the left so the logo
      // clears the traffic lights. On Windows we render our own controls.
      className={`liquid-glass flex items-center gap-2 rounded-md py-2 ${
        isMacOS ? 'pr-2.5 pl-[78px]' : 'px-2.5'
      }`}
      data-tauri-drag-region
    >
      <img
        src="/sososo_brand_logo_white-bg-transparent.png"
        alt="sososo"
        draggable={false}
        className="h-[18px] w-auto object-contain select-none"
      />
      <span className="flex-1" />
      {!isMacOS && (
        <>
          <button
            className={`${ICON_BTN} hover:bg-hover hover:text-fg`}
            title="Minimize"
            aria-label="Minimize"
            onClick={() => void minimizeSelf()}
          >
            <HugeiconsIcon icon={IconMinimize} size={16} strokeWidth={2} aria-hidden={true} />
          </button>
          <button
            className={`${ICON_BTN} hover:bg-hover hover:text-fg`}
            title={maximized ? 'Restore' : 'Maximize'}
            aria-label={maximized ? 'Restore' : 'Maximize'}
            onClick={() => void toggleMaximizeSelf()}
          >
            {maximized ? <RestoreGlyph /> : <MaximizeGlyph />}
          </button>
          <button
            className={`${ICON_BTN} hover:bg-[rgba(255,93,93,0.22)] hover:text-[#ffd9d9]`}
            title="Close"
            aria-label="Close"
            onClick={() => void closeSelf()}
          >
            <HugeiconsIcon icon={IconClose} size={16} strokeWidth={2} aria-hidden={true} />
          </button>
        </>
      )}
    </header>
  );
}
