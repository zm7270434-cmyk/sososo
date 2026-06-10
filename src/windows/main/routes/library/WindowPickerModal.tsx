import { useCallback, useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import type { WindowInfo } from '../../../../types/domain';
import { filterWindows, prettyAppName } from '../../../../lib/windowPicker';
import {
  IconAbout,
  IconCheck,
  IconClose,
  IconRegenerate,
  IconSearch,
  IconWindow,
} from '../../../../lib/icons';

interface WindowPickerModalProps {
  open: boolean;
  windows: WindowInfo[];
  /** True while the window list (with thumbnails) is being (re)fetched. */
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onClose: () => void;
}

/** Zoom-style window picker: a searchable grid of live window thumbnails.
 *  Clicking a card selects that window and closes the dialog. */
export default function WindowPickerModal({
  open,
  windows,
  loading,
  selectedId,
  onSelect,
  onRefresh,
  onClose,
}: WindowPickerModalProps) {
  const [query, setQuery] = useState('');

  // Every way out funnels through here so the next open starts with a fresh
  // search (the parent only ever opens the dialog, never closes it directly).
  const close = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  // Close on Escape like a native dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  const visible = filterWindows(windows, query);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5"
      onClick={close}
      role="presentation"
    >
      <div
        className="liquid-glass flex max-h-[80vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[14px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a window to record"
      >
        <div className="flex items-center gap-2 border-b border-glass-border px-4 py-3">
          <HugeiconsIcon
            icon={IconWindow}
            size={16}
            strokeWidth={1.8}
            className="shrink-0 text-accent"
            aria-hidden={true}
          />
          <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg">
            Choose a window to record
          </h3>
          <button
            type="button"
            className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-sm border border-glass-border bg-[rgba(255,255,255,0.05)] p-[7px] text-fg-dim shadow-liquid hover:bg-hover hover:text-fg disabled:cursor-default disabled:opacity-60"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh window list"
            aria-label="Refresh window list"
          >
            <HugeiconsIcon
              icon={IconRegenerate}
              size={14}
              strokeWidth={1.8}
              className={loading ? 'animate-spin' : undefined}
              aria-hidden={true}
            />
          </button>
          <button
            type="button"
            className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-sm border border-glass-border bg-[rgba(255,255,255,0.05)] p-[7px] text-fg-dim shadow-liquid hover:bg-hover hover:text-fg"
            onClick={close}
            title="Close"
            aria-label="Close"
          >
            <HugeiconsIcon icon={IconClose} size={14} strokeWidth={1.8} aria-hidden={true} />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 rounded-sm border border-glass-border bg-[rgba(255,255,255,0.05)] px-[11px] py-[8px] focus-within:border-accent">
            <HugeiconsIcon
              icon={IconSearch}
              size={14}
              strokeWidth={1.8}
              className="shrink-0 text-fg-faint"
              aria-hidden={true}
            />
            <input
              type="text"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-faint"
              placeholder="Search by app or title…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              aria-label="Search windows"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label="Loading windows">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-[8px] border border-glass-border bg-[rgba(255,255,255,0.04)] p-1.5"
                >
                  <div className="aspect-video w-full rounded-[5px] bg-[rgba(255,255,255,0.07)]" />
                  <div className="mt-1.5 h-[10px] w-2/3 rounded-full bg-[rgba(255,255,255,0.07)]" />
                  <div className="mt-1 h-[9px] w-full rounded-full bg-[rgba(255,255,255,0.05)]" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <HugeiconsIcon
                icon={IconWindow}
                size={28}
                strokeWidth={1.5}
                className="text-fg-faint"
                aria-hidden={true}
              />
              <p className="text-[13px] text-fg-faint">
                {windows.length === 0
                  ? 'No capturable windows found. Open the app you want to record, then refresh.'
                  : 'No windows match your search.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="listbox">
              {visible.map((w) => {
                const selected = w.id === selectedId;
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onSelect(w.id);
                      close();
                    }}
                    title={`${prettyAppName(w.app)} — ${w.title}`}
                    className={`flex cursor-pointer flex-col gap-1.5 rounded-[8px] border p-1.5 text-left transition duration-[120ms] active:scale-[0.98] ${
                      selected
                        ? 'border-[rgba(110,168,254,0.55)] bg-[rgba(110,168,254,0.16)] shadow-liquid'
                        : 'border-glass-border bg-[rgba(255,255,255,0.04)] hover:bg-hover'
                    }`}
                  >
                    <div className="relative aspect-video w-full overflow-hidden rounded-[5px] border border-glass-border bg-[rgba(0,0,0,0.45)]">
                      {w.thumbnail ? (
                        <img
                          src={w.thumbnail}
                          alt=""
                          className="h-full w-full object-contain"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <HugeiconsIcon
                            icon={IconWindow}
                            size={24}
                            strokeWidth={1.5}
                            className="text-fg-faint"
                            aria-hidden={true}
                          />
                        </div>
                      )}
                      {selected && (
                        <span className="absolute top-1 right-1 inline-flex items-center justify-center rounded-full bg-[#6ea8fe] p-[3px] text-[#0b1626]">
                          <HugeiconsIcon
                            icon={IconCheck}
                            size={12}
                            strokeWidth={2.2}
                            aria-hidden={true}
                          />
                        </span>
                      )}
                    </div>
                    <span className="flex min-w-0 flex-col gap-px px-0.5 pb-0.5">
                      <span className="truncate text-[12px] leading-tight font-semibold text-fg">
                        {prettyAppName(w.app) || w.title}
                      </span>
                      <span className="truncate text-[10.5px] leading-tight text-fg-faint">
                        {w.title}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-glass-border px-4 py-2.5">
          <span className="inline-flex items-start gap-1.5 text-[10.5px] leading-snug text-fg-faint">
            <HugeiconsIcon
              icon={IconAbout}
              size={12}
              strokeWidth={1.8}
              className="mt-px shrink-0"
              aria-hidden={true}
            />
            <span>
              Capture is per window. To record a single browser tab (like sharing a tab in Google
              Meet), drag that tab out into its own window first, then pick it here.
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
