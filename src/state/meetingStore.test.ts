import { beforeEach, describe, expect, test } from 'bun:test';

import { useMeetingStore } from './meetingStore';

const ZOOM = { platform: 'Zoom', title: 'Zoom Meeting' };
const MEET = { platform: 'Google Meet', title: 'Meet – abc-defg-hij' };

const initial = useMeetingStore.getState();

describe('useMeetingStore', () => {
  beforeEach(() => {
    useMeetingStore.setState(initial, true);
  });

  test('a newly detected meeting raises the banner and asks to notify once', () => {
    expect(useMeetingStore.getState().apply(ZOOM)).toBe(true);
    expect(useMeetingStore.getState().banner).toEqual(ZOOM);

    // Same meeting on the next poll: banner stays, but no re-notification.
    expect(useMeetingStore.getState().apply(ZOOM)).toBe(false);
    expect(useMeetingStore.getState().banner).toEqual(ZOOM);
  });

  test('dismiss snoozes that platform until the meeting disappears', () => {
    useMeetingStore.getState().apply(ZOOM);
    useMeetingStore.getState().dismiss();
    expect(useMeetingStore.getState().banner).toBeNull();

    // Still detected while snoozed: stays hidden, never notifies.
    expect(useMeetingStore.getState().apply(ZOOM)).toBe(false);
    expect(useMeetingStore.getState().banner).toBeNull();

    // Meeting gone → snooze resets; the next meeting prompts again.
    expect(useMeetingStore.getState().apply(null)).toBe(false);
    expect(useMeetingStore.getState().apply(ZOOM)).toBe(true);
    expect(useMeetingStore.getState().banner).toEqual(ZOOM);
  });

  test('a different platform breaks through a snooze', () => {
    useMeetingStore.getState().apply(ZOOM);
    useMeetingStore.getState().dismiss();

    expect(useMeetingStore.getState().apply(MEET)).toBe(true);
    expect(useMeetingStore.getState().banner).toEqual(MEET);
  });

  test('no meeting clears the banner', () => {
    useMeetingStore.getState().apply(ZOOM);
    useMeetingStore.getState().apply(null);
    expect(useMeetingStore.getState().banner).toBeNull();
  });
});
