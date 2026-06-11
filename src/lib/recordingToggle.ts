import { useSessionStore } from '../state/sessionStore';
import { startSession, stopSession } from './ipc';
import type { SessionStateName } from '../types/domain';

/** What a global start/stop toggle (hotkey, tray) should do in a given session
 *  state. Mid-transition states are ignored so a toggle can never double-start
 *  or double-stop a session. */
export type ToggleAction = 'start' | 'stop' | 'ignore';

export function toggleActionFor(state: SessionStateName): ToggleAction {
  switch (state) {
    case 'idle':
    case 'stopped':
    case 'error':
      return 'start';
    case 'recording':
    case 'reconnecting':
      return 'stop';
    default:
      return 'ignore'; // starting | stopping
  }
}

/** Start a session with optimistic store state; backend events refine it.
 *  Module-level (not a hook) so the hotkey/tray toggle and `useSession` share
 *  one code path. */
export async function startRecording(title?: string): Promise<void> {
  const { patch } = useSessionStore.getState();
  patch({ state: 'starting', error: null });
  try {
    await startSession(title);
  } catch (e) {
    patch({ state: 'error', error: String(e) });
  }
}

/** Stop the active session with optimistic store state. */
export async function stopRecording(): Promise<void> {
  const { patch } = useSessionStore.getState();
  patch({ state: 'stopping' });
  try {
    await stopSession();
  } catch (e) {
    patch({ state: 'error', error: String(e) });
  }
}

/** Handle one `recording://toggle` event (global hotkey or tray): start when
 *  settled-idle, stop when live, ignore mid-transition. */
export async function handleRecordingToggle(): Promise<void> {
  const action = toggleActionFor(useSessionStore.getState().state);
  if (action === 'start') await startRecording();
  else if (action === 'stop') await stopRecording();
}
