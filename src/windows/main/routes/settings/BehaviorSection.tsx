import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';

import { MEETING_DETECTION_SUPPORTED } from '../../../../hooks/useMeetingDetection';
import { IconSettings } from '../../../../lib/icons';
import { getActiveShortcut, setGlobalShortcutEnabled as ipcSetShortcut } from '../../../../lib/ipc';
import { isMacOS } from '../../../../lib/platform';
import { useConfigStore } from '../../../../state/configStore';

import { FIELD_LABEL, H3 } from './styles';

const CHECKBOX = 'mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#6ea8fe]';
/** Static fallback label (shown while loading / outside a Tauri webview). */
const SHORTCUT_LABEL = isMacOS ? 'Ctrl+Cmd+R' : 'Ctrl+Alt+R';

/** Behavior settings (tray + background-running preferences). Self-contained:
 *  reads and writes the config store directly; `MainApp` syncs the values that
 *  the backend needs to know about. */
export function BehaviorSection() {
  const closeToTray = useConfigStore((s) => s.closeToTray);
  const setCloseToTray = useConfigStore((s) => s.setCloseToTray);
  const globalShortcutEnabled = useConfigStore((s) => s.globalShortcutEnabled);
  const setGlobalShortcutEnabled = useConfigStore((s) => s.setGlobalShortcutEnabled);
  const meetingDetectionEnabled = useConfigStore((s) => s.meetingDetectionEnabled);
  const setMeetingDetectionEnabled = useConfigStore((s) => s.setMeetingDetectionEnabled);

  // The combo the toggle is actually bound to (another app may own the primary,
  // in which case the backend falls back to the +Shift variant). undefined =
  // unknown (loading, or outside a Tauri webview) → show the static label.
  const [activeShortcut, setActiveShortcut] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    // Re-apply the pref first (idempotent) so the readback can't race the
    // MainApp sync, then read which combo actually stuck.
    ipcSetShortcut(globalShortcutEnabled)
      .then(() => getActiveShortcut())
      .then((s) => {
        if (alive) setActiveShortcut(s);
      })
      .catch(() => {
        if (alive) setActiveShortcut(undefined); // not in Tauri — no live info
      });
    return () => {
      alive = false;
    };
  }, [globalShortcutEnabled]);
  const shortcutUnavailable = globalShortcutEnabled && activeShortcut === null;

  return (
    <section className="mb-7">
      <h3 className={H3}>
        <HugeiconsIcon icon={IconSettings} size={13} strokeWidth={1.8} aria-hidden={true} />
        Behavior
      </h3>

      <label className="mb-3.5 flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          className={CHECKBOX}
          checked={closeToTray}
          onChange={(e) => setCloseToTray(e.target.checked)}
        />
        <span className="flex flex-col gap-0.5">
          <span className={FIELD_LABEL}>Keep running in the tray when the window is closed</span>
          <span className="text-[11.5px] leading-[1.4] text-fg-faint">
            Closing the window hides sososo to the system tray instead of quitting, so a recording
            keeps running in the background. Reopen from the tray icon; quit for real from its menu.
          </span>
        </span>
      </label>

      <label className="mb-3.5 flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          className={CHECKBOX}
          checked={globalShortcutEnabled}
          onChange={(e) => setGlobalShortcutEnabled(e.target.checked)}
        />
        <span className="flex flex-col gap-0.5">
          <span className={FIELD_LABEL}>
            Global shortcut to start / stop recording{' '}
            <kbd className="ml-1 rounded-sm border border-glass-border bg-[rgba(255,255,255,0.07)] px-1.5 py-px font-sans text-[11px] text-fg-dim">
              {activeShortcut ?? SHORTCUT_LABEL}
            </kbd>
          </span>
          <span className="text-[11.5px] leading-[1.4] text-fg-faint">
            Works while any app has focus — even with sososo hidden in the tray. Starts a recording
            when idle and finishes the running one; presses during startup/shutdown are ignored.
          </span>
          {shortcutUnavailable && (
            <span className="text-[11.5px] leading-[1.4] text-[#ffb454]">
              Currently unavailable — both {SHORTCUT_LABEL} and its Shift variant are taken by
              another app. Close the app that owns them, then toggle this off and on.
            </span>
          )}
        </span>
      </label>

      {MEETING_DETECTION_SUPPORTED && (
        <label className="mb-3.5 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className={CHECKBOX}
            checked={meetingDetectionEnabled}
            onChange={(e) => setMeetingDetectionEnabled(e.target.checked)}
          />
          <span className="flex flex-col gap-0.5">
            <span className={FIELD_LABEL}>Offer to record when a meeting is detected</span>
            <span className="text-[11.5px] leading-[1.4] text-fg-faint">
              While idle, sososo checks your open windows every few seconds for an active Zoom,
              Microsoft Teams, Google Meet, or Webex meeting and shows a one-click &quot;Start
              recording&quot; banner (plus a system notification when the app is in the background).
              Dismissing it snoozes that meeting. Window titles are checked locally — nothing leaves
              your device.
            </span>
          </span>
        </label>
      )}
    </section>
  );
}
