import { HugeiconsIcon } from '@hugeicons/react';
import { IconClose, IconRecord } from '../../lib/icons';
import { startRecording } from '../../lib/recordingToggle';
import { useMeetingStore } from '../../state/meetingStore';

const BTN_PRIMARY =
  'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-[rgba(255,255,255,0.3)] bg-[rgba(110,168,254,0.24)] px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-[#dbe8ff] shadow-liquid hover:bg-[rgba(110,168,254,0.34)]';
const ICON_BTN =
  'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm bg-transparent text-fg-dim hover:bg-hover hover:text-fg';

/** Slim banner under the titlebar offering to record a detected meeting
 *  (Zoom/Teams/Meet/Webex — see `useMeetingDetection`). Renders nothing while
 *  no meeting is offered, so it takes no space normally. Dismissing snoozes
 *  that platform until its meeting ends; starting does too, so the prompt
 *  doesn't reappear for a meeting that was just recorded. */
export default function MeetingBanner() {
  const banner = useMeetingStore((s) => s.banner);
  const dismiss = useMeetingStore((s) => s.dismiss);
  if (!banner) return null;

  function onStart() {
    dismiss(); // hide + snooze this meeting before the view switches
    void startRecording();
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-[rgba(110,168,254,0.4)] bg-[rgba(110,168,254,0.13)] px-3.5 py-2.5 text-[13px]">
      <HugeiconsIcon
        icon={IconRecord}
        size={17}
        strokeWidth={1.8}
        className="shrink-0 text-accent"
        aria-hidden={true}
      />
      <div className="min-w-0 flex-1 leading-[1.4]">
        <span className="text-fg-dim">
          <b className="text-fg">{banner.platform} meeting detected</b> — start recording &amp;
          transcribing it?
        </span>
      </div>
      <button type="button" className={BTN_PRIMARY} onClick={onStart}>
        <HugeiconsIcon icon={IconRecord} size={14} strokeWidth={1.9} aria-hidden={true} />
        Start recording
      </button>
      <button
        type="button"
        className={ICON_BTN}
        title="Dismiss for this meeting"
        aria-label="Dismiss for this meeting"
        onClick={dismiss}
      >
        <HugeiconsIcon icon={IconClose} size={15} strokeWidth={2} aria-hidden={true} />
      </button>
    </div>
  );
}
