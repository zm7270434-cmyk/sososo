import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { IconDownload, IconRegenerate, IconClose, IconAlert } from '../../lib/icons';
import { useUpdateStore } from '../../state/updateStore';
import { downloadAndInstall, restartApp } from '../../lib/updater';

const BTN_PRIMARY =
  'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-[rgba(255,255,255,0.3)] bg-[rgba(110,168,254,0.24)] px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-[#dbe8ff] shadow-liquid hover:bg-[rgba(110,168,254,0.34)]';
const ICON_BTN =
  'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm bg-transparent text-fg-dim hover:bg-hover hover:text-fg';

/** Slim banner under the titlebar that surfaces an available / installing /
 *  installed update. Renders nothing unless the updater has something to show,
 *  so it takes no space when idle, checking, or already up to date. */
export default function UpdateBanner() {
  const status = useUpdateStore((s) => s.status);
  const version = useUpdateStore((s) => s.version);
  const downloaded = useUpdateStore((s) => s.downloaded);
  const contentLength = useUpdateStore((s) => s.contentLength);
  const error = useUpdateStore((s) => s.error);
  const [dismissed, setDismissed] = useState(false);

  const visible =
    (status === 'available' && !dismissed) ||
    status === 'downloading' ||
    status === 'ready' ||
    (status === 'error' && version != null);
  if (!visible) return null;

  const pct =
    contentLength && contentLength > 0
      ? Math.min(100, Math.round((downloaded / contentLength) * 100))
      : null;
  const isError = status === 'error';

  return (
    <div
      className={`flex items-center gap-3 rounded-md border px-3.5 py-2.5 text-[13px] ${
        isError
          ? 'border-[rgba(255,180,84,0.4)] bg-[rgba(255,180,84,0.1)]'
          : 'border-[rgba(110,168,254,0.4)] bg-[rgba(110,168,254,0.13)]'
      }`}
    >
      <HugeiconsIcon
        icon={isError ? IconAlert : IconDownload}
        size={17}
        strokeWidth={1.8}
        className={isError ? 'shrink-0 text-[#ffb454]' : 'shrink-0 text-accent'}
        aria-hidden={true}
      />
      <div className="min-w-0 flex-1 leading-[1.4]">
        {status === 'available' && (
          <span className="text-fg-dim">
            <b className="text-fg">Update available</b>
            {version ? ` — version ${version} is ready to install.` : ' — a new version is ready.'}
          </span>
        )}
        {status === 'downloading' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-fg-dim">
              Downloading update{version ? ` ${version}` : ''}…{pct != null ? ` ${pct}%` : ''}
            </span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.12)]">
              <div
                className={`h-full rounded-full bg-accent ${
                  pct == null ? 'animate-pulse' : 'transition-[width] duration-200'
                }`}
                style={{ width: pct != null ? `${pct}%` : '45%' }}
              />
            </div>
          </div>
        )}
        {status === 'ready' && (
          <span className="text-fg-dim">
            <b className="text-fg">Update installed</b>
            {version
              ? ` — restart to finish updating to ${version}.`
              : ' — restart to finish updating.'}
          </span>
        )}
        {isError && <span className="text-[#ffb454]">Update failed: {error}</span>}
      </div>

      {status === 'available' && (
        <>
          <button type="button" className={BTN_PRIMARY} onClick={() => void downloadAndInstall()}>
            <HugeiconsIcon icon={IconDownload} size={14} strokeWidth={1.9} aria-hidden={true} />
            Download &amp; install
          </button>
          <button
            type="button"
            className={ICON_BTN}
            title="Dismiss"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
          >
            <HugeiconsIcon icon={IconClose} size={15} strokeWidth={2} aria-hidden={true} />
          </button>
        </>
      )}
      {status === 'ready' && (
        <button type="button" className={BTN_PRIMARY} onClick={() => void restartApp()}>
          <HugeiconsIcon icon={IconRegenerate} size={14} strokeWidth={1.9} aria-hidden={true} />
          Restart now
        </button>
      )}
      {isError && version != null && (
        <button type="button" className={BTN_PRIMARY} onClick={() => void downloadAndInstall()}>
          Retry
        </button>
      )}
    </div>
  );
}
