# Session-detail: translate transcript + summary-language selector

Goal: bring translation to the saved-session results page (previously live-only) and let users
pick the AI-summary output language directly on that page.

## Changes

- **Backend** (`src-tauri/src/db.rs`): expose `segment_id` on `StoredSegment` (struct field +
  `get_session` SELECT/row-mapping). Column already existed; only needed to surface it so the
  history view can call `translate_segment`. No schema change, no new command.
- **Types** (`src/types/domain.ts`): add `segmentId: string` to `StoredSegment`.
- **Frontend** (`src/windows/main/routes/SessionDetailRoute.tsx`):
  - AI Summary panel: language `<select>` (`SUMMARY_LANGUAGES`) in the header. Reads the persisted
    global setting on mount (`getSummaryLanguage`); changing it writes back (`setSummaryLanguage`)
    and drives `doSummarize` (replaces the old read-global-on-click).
  - Transcript section: new header row with a target-language `<select>` (`TRANSLATE_TARGETS`,
    bound to `configStore.targetLanguage`/`setTargetLanguage`, shared with live-translate) + a
    **Translate** button. `doTranslate` batch-translates saved lines via `translateSegment`
    (concurrency 4), mirrors each result into local state for progressive fill-in, shows
    `Translating x/y…` progress + a per-line "Translating…" hint. First line runs alone to surface
    a fatal error (e.g. missing API key) before fanning out; per-line failures are tolerated.

## Decisions

- Summary language **reads/writes the global setting** (no per-session column) — matches existing
  architecture.
- Translate target **reuses** the live-translate `targetLanguage` (one consistent, persisted choice).
- A different target **overwrites** a line's prior translation (single `translation` column) — backend
  `translate_segment` behavior; no schema change.

## Verification

- `bun run build` (tsc strict + vite) — pass.
- `cargo check` / `cargo clippy` (from `src-tauri`) — pass (no new warnings; pre-existing mixer.rs
  warnings untouched, out of scope).

## Notes

- `SessionDetailRoute.tsx` was concurrently edited by another agent (rich `SummaryView`/`renderInline`
  refactor, bottom of file). Only this feature's hunks were committed; that refactor was left
  unstaged for its owner.
