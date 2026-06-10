import { HugeiconsIcon } from '@hugeicons/react';

import { IconSettings } from '../../../../lib/icons';
import { useConfigStore } from '../../../../state/configStore';

import { FIELD_LABEL, H3 } from './styles';

const CHECKBOX = 'mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#6ea8fe]';

/** Behavior settings (tray + background-running preferences). Self-contained:
 *  reads and writes the config store directly; `MainApp` syncs the values that
 *  the backend needs to know about. */
export function BehaviorSection() {
  const closeToTray = useConfigStore((s) => s.closeToTray);
  const setCloseToTray = useConfigStore((s) => s.setCloseToTray);

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
    </section>
  );
}
