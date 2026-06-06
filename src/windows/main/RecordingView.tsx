import { useEffect, useRef } from "react";
import clsx from "clsx";
import { useSession } from "../../hooks/useSession";
import { useElapsedLabel } from "../../hooks/useElapsedTimer";
import { useTranscriptStore } from "../../state/transcriptStore";

/**
 * Full-window live transcription view. Rendered by `MainApp` whenever a session
 * is active, so starting a recording turns the whole window into the transcript.
 * The top bar carries the Pause/Resume and Finish (Selesai) controls.
 */
export default function RecordingView() {
  const { state, error, paused, stop, togglePause } = useSession();
  const elapsed = useElapsedLabel();
  const segments = useTranscriptStore((s) => s.segments);
  const endRef = useRef<HTMLDivElement>(null);
  const last = segments[segments.length - 1];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [segments.length, last?.text]);

  const stopping = state === "stopping";
  const status =
    state === "starting"
      ? "Menyiapkan…"
      : stopping
        ? "Menyelesaikan…"
        : paused
          ? "Dijeda"
          : "Merekam";

  return (
    <div className="recording">
      <header className="rec-topbar">
        <span
          className={clsx(
            "rec-dot",
            !paused && state === "recording" && "is-live",
            state === "error" && "is-error",
          )}
        />
        <span className="rec-status">{status}</span>
        <span className="rec-timer">{elapsed}</span>
        <span className="spacer" />
        <button
          className="rec-action"
          onClick={() => void togglePause()}
          disabled={state !== "recording"}
          title={paused ? "Lanjutkan transkripsi" : "Jeda transkripsi"}
        >
          {paused ? "▶ Lanjutkan" : "⏸ Jeda"}
        </button>
        <button
          className="rec-action finish"
          onClick={() => void stop()}
          disabled={stopping || state === "starting"}
          title="Selesai & buka ringkasan"
        >
          {stopping ? "Menyelesaikan…" : "✓ Selesai"}
        </button>
      </header>

      <div className="rec-captions">
        {segments.length === 0 ? (
          <p className="rec-hint">
            {state === "starting"
              ? "Menyambungkan ke Deepgram…"
              : "Transkrip langsung akan muncul di sini saat ada suara."}
          </p>
        ) : (
          segments.map((c) => (
            <div
              key={c.segmentId}
              className={clsx("caption", c.source, !c.isFinal && "interim")}
            >
              <span className="speaker">
                {c.speaker ?? (c.source === "you" ? "You" : "Speaker")}
              </span>
              <span className="caption-text">{c.text}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {state === "error" && error && <p className="rec-error">{error}</p>}
    </div>
  );
}
