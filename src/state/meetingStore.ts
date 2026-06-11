import { create } from 'zustand';
import type { DetectedMeeting } from '../types/domain';

interface MeetingStore {
  /** The meeting currently offered in the banner, or null when hidden. */
  banner: DetectedMeeting | null;
  /** Platform dismissed by the user — stays hidden until that meeting ends. */
  snoozedPlatform: string | null;
  /** Fold in one poll result. Returns true when this transition should fire an
   *  OS notification (a meeting newly appeared and isn't snoozed). */
  apply: (detected: DetectedMeeting | null) => boolean;
  /** Hide the banner and snooze its platform until the meeting disappears.
   *  Also used when recording starts, so the prompt doesn't reappear for the
   *  same meeting right after it ends. */
  dismiss: () => void;
}

export const useMeetingStore = create<MeetingStore>((set, get) => ({
  banner: null,
  snoozedPlatform: null,
  apply: (detected) => {
    const { banner, snoozedPlatform } = get();
    if (!detected) {
      // Meeting over: clear everything so the next one prompts again.
      if (banner || snoozedPlatform) set({ banner: null, snoozedPlatform: null });
      return false;
    }
    if (detected.platform === snoozedPlatform) return false;
    const isNew = banner?.platform !== detected.platform;
    // Keep the title fresh (e.g. the tab's meeting code changed) either way.
    set({ banner: detected, snoozedPlatform: null });
    return isNew;
  },
  dismiss: () => {
    const { banner } = get();
    if (banner) set({ banner: null, snoozedPlatform: banner.platform });
  },
}));
