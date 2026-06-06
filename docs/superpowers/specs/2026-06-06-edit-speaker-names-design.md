# Edit Speaker Names — Design

**Date:** 2026-06-06
**Status:** Approved (design)
**Scope:** Rename diarized speaker labels in a saved session's transcript.

## Problem

Deepgram diarization labels remote segments `"Speaker 1"`, `"Speaker 2"`, … and the
user's own mic as `"You"`. Users want to replace these with real names (e.g.
`"Speaker 1"` → `"Alice"`) so the transcript — and any later AI summary — reads naturally.

## Decisions

- **Location:** saved session detail (history) only. Live `RecordingView` is untouched
  (new segments keep arriving with the original label during a live session, so live
  rename is out of scope for v1).
- **Storage:** overwrite in place via `UPDATE segments.speaker`. No mapping table, no
  reset-to-original. Mirrors the existing `rename_session` pattern.
- **Unit of rename:** the whole session — all segments sharing one stored `speaker`
  value are renamed together.
- **UI:** option A — a "Speakers" panel above the transcript with one editable chip
  per distinct speaker.

## Data model (unchanged)

`segments.speaker TEXT` (nullable). Per segment:

- `source = 'you'` → `speaker = "You"`.
- `source = 'remote'` → `speaker = "Speaker N"` (1-based) or `NULL` (remote line with no
  diarization word; displayed as "Speaker").

Speaker values are unique per session (`"You"` vs `"Speaker N"` never collide), so the
exact stored string identifies a group. `source` is never changed by a rename, so the
mic/remote icon and the reserved `You` accent colour stay correct.

## Backend (Rust)

- `db.rs` → `rename_speaker(session_id: i64, from: Option<&str>, to: &str) -> AppResult<usize>`
  - `UPDATE segments SET speaker = ?to WHERE session_id = ?sid AND speaker IS ?from`
  - `IS` (not `=`) so the `NULL` group is matched. Returns rows changed.
- `commands.rs` → `rename_speaker(state/db, session_id, from, to)` command.
  - Trim `to`; reject empty (`AppError`). `from` passes through (may be `None`).
- `lib.rs` → register `rename_speaker` in `invoke_handler!`.

## IPC (TypeScript)

- `lib/ipc.ts`:
  ```ts
  export const renameSpeaker = (
    sessionId: number,
    from: string | null,
    to: string,
  ): Promise<number> => invoke('rename_speaker', { sessionId, from, to });
  ```

## UI (`windows/main/routes/SessionDetailRoute.tsx`)

- Derive distinct speakers from `segments`, in first-appearance order:
  `{ stored: string | null, display: string, source: Source, count: number }`
  where `display = speaker ?? (source === 'you' ? 'You' : 'Speaker')`.
- Render a **Speakers** panel above the transcript list: each chip = colour dot
  (`speakerColor(source, display)`) + name + `count` lines + a pencil button
  (`IconRename`). Hidden when there are 0 segments.
- Editing one chip swaps it for an inline `<input>` reusing the title-edit pattern:
  Enter saves, Escape cancels, blur saves, `autoFocus`.
- Save flow: trim; if empty or unchanged → close editor (no-op). Otherwise call
  `renameSpeaker(sessionId, stored, next)` then **optimistically** update
  `detail.segments` (set `speaker = next` on every segment whose current `speaker`
  matches `stored`). No refetch. The summary is not touched.
- Errors surface through the existing `err` block.

## Edge cases

- Two speakers renamed to the same name → they merge visually (same hashed colour).
  Accepted for v1.
- Renaming the `NULL` ("Speaker") group: `from = null`, handled by the `IS` clause.
- Renaming `"You"`: allowed; `source` stays `you`, so icon + accent colour persist.

## Out of scope

- Live-recording rename, reset-to-original, a speakers DB table, re-running the AI
  summary after a rename.

## Verification

- `bun run build` (TS strict: `noUnusedLocals`/`noUnusedParameters`).
- `cargo check` and `cargo clippy` in `src-tauri/`.
