import { useEffect } from 'react';

import { detectMeeting, notify } from '../lib/ipc';
import { isLinux, isMacOS } from '../lib/platform';
import { toggleActionFor } from '../lib/recordingToggle';
import { useConfigStore } from '../state/configStore';
import { useMeetingStore } from '../state/meetingStore';
import { useSessionStore } from '../state/sessionStore';

/** Window enumeration exists on Windows only for now (macOS polling would
 *  trigger the screen-recording permission prompt; Linux has no backend). */
export const MEETING_DETECTION_SUPPORTED = !isMacOS && !isLinux;

const POLL_MS = 5_000;

/** Poll for an active meeting while idle (and enabled) and fold the results
 *  into the meeting store; a newly seen meeting also fires an OS notification
 *  when the app isn't focused (e.g. hidden in the tray). Mount once. */
export function useMeetingDetection(): void {
  const enabled = useConfigStore((s) => s.meetingDetectionEnabled);
  const state = useSessionStore((s) => s.state);
  // Only poll in states where the banner's "Start recording" makes sense.
  const active = MEETING_DETECTION_SUPPORTED && enabled && toggleActionFor(state) === 'start';

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const tick = async () => {
      let detected = null;
      try {
        detected = await detectMeeting();
      } catch {
        return; // outside a Tauri webview (plain `vite dev`)
      }
      if (cancelled) return;
      const shouldNotify = useMeetingStore.getState().apply(detected);
      if (shouldNotify && detected && !document.hasFocus()) {
        notify(
          `${detected.platform} meeting detected`,
          'Open sososo to record and transcribe it.',
        ).catch(() => {});
      }
    };

    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active]);
}
