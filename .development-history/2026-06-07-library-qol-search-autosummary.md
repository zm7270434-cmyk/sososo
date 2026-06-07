# Library QoL — Search + Auto-summarize + Summarized badge + Title-at-start

Date: 2026-06-07

## Goal

Close four recurring library/capture gaps in a single bundle (data already existed in SQLite; no new
deps): no way to search transcripts, summaries triggered only manually, no at-a-glance "summarized"
marker, and recordings starting untitled.

## Key changes

### 1. Title at recording start (frontend-only)

- `useSession.start()` → `start(title?)`, forwarded to the existing `startSession(title)` (backend already
  accepted an optional title; blank → `"Recording dd-mm-YYYY HH:MM"`).
- `LibraryRoute`: optional "Session title" text input above Start.

### 2. "Summarized" badge in sidebar (frontend-only)

- `SessionSidebar`: render `IconAi` next to a session's title when `summary != null` (already in the
  `listSessions()` payload).

### 3. Auto-summarize on finish (toggle, default ON)

- `configStore`: `autoSummarizeOnFinish` (persisted, default `true`) + setter.
- `SettingsRoute`: toggle under the AI provider field.
- `MainApp`: on the stop→detail navigation, pass `state.autoSummarize = true` (only the just-finished
  path; opening an old session carries no such state).
- `SessionDetailRoute`: one-shot effect (ref-guarded, reset per session) that calls the existing
  `summarizeSession` when arriving with `autoSummarize`, the toggle is on, no summary exists, segments
  exist, and the active provider's key is set (`hasApiKey(getAiProvider())`). Missing key → skipped
  silently; manual "Finish & Summarize" stays.

### 4. Full-text search (FTS5) + in-transcript find

- **Backend (`db.rs`):** external-content FTS5 table `segments_fts(text)` over `segments`, kept in sync by
  `AFTER INSERT/DELETE/UPDATE` triggers (the UPDATE one guarded by `WHEN new.text IS NOT old.text`, so
  rename-speaker / save-translation don't reindex). `migrate()` builds the index for pre-existing DBs via
  a one-time, flag-gated FTS5 `rebuild` (`fts_built` setting) — see Fix below. `search_sessions(query)`
  groups `MATCH` hits per session, ranks by
  `bm25`, returns `snippet()` (terms wrapped in `[`…`]`) + match count. `to_fts_query` quotes each
  alnum token as a prefix term (`"foo"*`), joined AND — punctuation can't trigger FTS5 syntax errors.
- **Command/IPC/type:** `search_sessions` command (registered in `lib.rs`), `searchSessions` IPC wrapper,
  `SearchHit` type, `IconSearch` added to the icon vocabulary.
- **Global search UI:** new `/main/search` route (`SearchRoute`) — debounced search-as-you-type, results
  with highlighted snippet + match count, click opens the session; "Search" entry added to the sidebar.
- **In-transcript find:** `SessionDetailRoute` find bar (toggle button + Ctrl/Cmd+F, Esc closes),
  client-side over loaded segments, match count + prev/next (`scrollIntoView`), highlights matches and
  rings the current line.

## Decisions

- FTS5 (external-content) over `LIKE`: gives ranking + highlighted snippets without duplicating text.
- In-transcript find is purely client-side (transcript already in memory) — no backend round-trip.
- Auto-summarize default ON but key-gated and silent without a key (avoids surprise errors / token spend
  when no provider is configured).

## Verification

- `bun run build` (tsc strict + vite) — green.
- `cargo check` + `cargo clippy` — green for the changed files (`db.rs`/`commands.rs`/`lib.rs`); the only
  clippy warnings are pre-existing in `audio/mixer.rs` (out of scope).
- FTS5 runtime validated with a throwaway probe: vtable + triggers create, `snippet()`/`bm25()`/prefix
  `MATCH` all work (rusqlite `bundled` ships FTS5). Probe removed, not committed.
- Remaining manual smoke (needs GUI + audio + API key): record w/ title → finish → auto-summary → badge →
  search a term → open hit → Ctrl/Cmd+F find.

## Fix (same day): existing transcripts returned no search results

- **Symptom:** search found nothing for words clearly present in saved transcripts.
- **Root cause:** the first cut gated the backfill on `SELECT count(*) FROM segments_fts == 0`. On an
  external-content FTS5 table `count(*)` reflects the _content_ table (`segments`), not the inverted
  index, so the guard was always false → the backfill never ran → the index stayed empty for pre-existing
  rows (triggers only index new inserts). Confirmed by probing a copy of the real DB: `count(*)=165` yet
  `MATCH` returned 0, while `INSERT INTO segments_fts(segments_fts) VALUES('rebuild')` made the same query
  return hits.
- **Fix:** replaced the count check with a one-time FTS5 `rebuild` gated by a `fts_built` flag in
  `app_settings`. Runs once when the index is introduced (no-op on a fresh DB); triggers keep it in sync
  thereafter. Verified broken→fixed→idempotent against a copy of the real database.
