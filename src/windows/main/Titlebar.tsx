import { HugeiconsIcon } from '@hugeicons/react';
import { closeSelf, minimizeSelf } from '../../lib/window';
import { IconClose, IconMinimize } from '../../lib/icons';

const ICON_BTN =
  'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm bg-transparent text-[14px] leading-none text-fg-dim transition-colors duration-[120ms] active:bg-active';

export default function Titlebar() {
  return (
    <header
      className="liquid-glass flex items-center gap-2 rounded-md px-2.5 py-2"
      data-tauri-drag-region
    >
      <img
        src="/sososo_brand_logo_white-bg-transparent.png"
        alt="sososo"
        draggable={false}
        className="h-[18px] w-auto object-contain select-none"
      />
      <span className="flex-1" />
      <button
        className={`${ICON_BTN} hover:bg-hover hover:text-fg`}
        title="Minimize"
        aria-label="Minimize"
        onClick={() => void minimizeSelf()}
      >
        <HugeiconsIcon icon={IconMinimize} size={16} strokeWidth={2} aria-hidden={true} />
      </button>
      <button
        className={`${ICON_BTN} hover:bg-[rgba(255,93,93,0.22)] hover:text-[#ffd9d9]`}
        title="Close"
        aria-label="Close"
        onClick={() => void closeSelf()}
      >
        <HugeiconsIcon icon={IconClose} size={16} strokeWidth={2} aria-hidden={true} />
      </button>
    </header>
  );
}
