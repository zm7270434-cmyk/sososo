import { useSessionStore } from '../state/sessionStore';
import { setPaused as ipcSetPaused } from '../lib/ipc';
import { startRecording, stopRecording } from '../lib/recordingToggle';

/** Start/stop/pause controls with optimistic state; backend events refine it.
 *  Start/stop share their implementation with the global hotkey/tray toggle
 *  (`lib/recordingToggle.ts`). */
export function useSession() {
  const state = useSessionStore((s) => s.state);
  const error = useSessionStore((s) => s.error);
  const paused = useSessionStore((s) => s.paused);
  const patch = useSessionStore((s) => s.patch);
  const setPausedLocal = useSessionStore((s) => s.setPaused);

  const isActive = state === 'recording' || state === 'starting';

  async function togglePause() {
    const next = !paused;
    setPausedLocal(next); // optimistic: freezes timer + flips the label
    try {
      await ipcSetPaused(next);
    } catch (e) {
      setPausedLocal(!next); // revert on failure
      patch({ error: String(e) });
    }
  }

  return {
    state,
    error,
    isActive,
    paused,
    start: startRecording,
    stop: stopRecording,
    togglePause,
  };
}
