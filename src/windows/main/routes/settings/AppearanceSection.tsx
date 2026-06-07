import { HugeiconsIcon } from '@hugeicons/react';

import { IconAppearance } from '../../../../lib/icons';
import {
  useConfigStore,
  UI_SCALE_MIN,
  UI_SCALE_MAX,
  TRANSCRIPT_SCALE_MIN,
  TRANSCRIPT_SCALE_MAX,
} from '../../../../state/configStore';

import { FIELD, FIELD_LABEL, H3 } from './styles';

/** Appearance settings (font sizes + background transparency). Self-contained:
 *  reads and writes the config store directly, so it needs no props. */
export function AppearanceSection() {
  const uiScale = useConfigStore((s) => s.uiScale);
  const transcriptScale = useConfigStore((s) => s.transcriptScale);
  const glassOpacity = useConfigStore((s) => s.glassOpacity);
  const setUiScale = useConfigStore((s) => s.setUiScale);
  const setTranscriptScale = useConfigStore((s) => s.setTranscriptScale);
  const setGlassOpacity = useConfigStore((s) => s.setGlassOpacity);

  return (
    <section className="mb-7">
      <h3 className={H3}>
        <HugeiconsIcon icon={IconAppearance} size={13} strokeWidth={1.8} aria-hidden={true} />
        Appearance
      </h3>

      <div className={FIELD}>
        <span className={FIELD_LABEL}>
          UI font size
          <em className="ml-1.5 text-[11.5px] text-fg-faint not-italic">
            {Math.round(uiScale * 100)}%
          </em>
        </span>
        <input
          type="range"
          min={UI_SCALE_MIN}
          max={UI_SCALE_MAX}
          step={0.05}
          value={uiScale}
          onChange={(e) => setUiScale(Number(e.target.value))}
          className="w-full cursor-pointer accent-accent"
        />
        <span className="text-[11.5px] leading-[1.4] text-fg-faint">
          Scales the whole interface (text, buttons, panels).
        </span>
      </div>

      <div className={FIELD}>
        <span className={FIELD_LABEL}>
          Transcript font size
          <em className="ml-1.5 text-[11.5px] text-fg-faint not-italic">
            {Math.round(transcriptScale * 100)}%
          </em>
        </span>
        <input
          type="range"
          min={TRANSCRIPT_SCALE_MIN}
          max={TRANSCRIPT_SCALE_MAX}
          step={0.05}
          value={transcriptScale}
          onChange={(e) => setTranscriptScale(Number(e.target.value))}
          className="w-full cursor-pointer accent-accent"
        />
        <span className="text-[11.5px] leading-[1.4] text-fg-faint">
          Transcript text &amp; speaker labels, in live recording and history.
        </span>
        <div className="mt-1 rounded-sm border border-glass-border bg-[rgba(255,255,255,0.04)] px-3 py-2">
          <div
            className="tracking-[0.05em] text-accent uppercase"
            style={{ fontSize: `${11 * transcriptScale}px` }}
          >
            You
          </div>
          <div className="leading-[1.5] text-fg" style={{ fontSize: `${14 * transcriptScale}px` }}>
            Sample live transcript line.
          </div>
        </div>
      </div>

      <div className={FIELD}>
        <span className={FIELD_LABEL}>
          Background transparency
          <em className="ml-1.5 text-[11.5px] text-fg-faint not-italic">
            {Math.round((1 - glassOpacity) * 100)}%
          </em>
        </span>
        <input
          type="range"
          min={5}
          max={85}
          step={5}
          value={Math.round((1 - glassOpacity) * 100)}
          onChange={(e) => setGlassOpacity(1 - Number(e.target.value) / 100)}
          className="w-full cursor-pointer accent-accent"
        />
        <span className="text-[11.5px] leading-[1.4] text-fg-faint">
          Higher = more see-through; the desktop behind shows through more.
        </span>
      </div>
    </section>
  );
}
