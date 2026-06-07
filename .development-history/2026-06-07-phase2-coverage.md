# Phase 2 — Test Coverage Expansion

**Date:** 2026-06-07 · **Program:** `docs/superpowers/specs/2026-06-07-professional-hardening-design.md`

## Goal

Grow real coverage over isolatable pure logic so Phase 3's structural refactors are
safe. (Frontend 11 → 24 tests; Rust 12 → 25 tests.)

## Added — frontend (`bun test`)

- `state/sessionStore.test.ts` — `patch` shallow-merge; `setPaused` pause-start +
  idempotence; resume accumulates `pausedTotalMs` (deterministic via `setSystemTime`).
- `state/updateStore.test.ts` — `patch` merge; `reset` → initial idle state.
- `state/libraryStore.test.ts` — `refresh` increments revision.
- `lib/languages.test.ts` — `languageLabel` lookup + fallback; `TRANSLATE_TARGETS`
  excludes `multi`; `SUMMARY_LANGUAGES` leads with `auto`; codes unique.
- `hooks/useElapsedTimer.test.ts` — `formatElapsed` HH:MM:SS padding + uncapped hours.

## Added — Rust (`cargo test`)

- `error.rs` — `AppError` category Display strings + serialize-to-plain-string contract.
- `db.rs` — against an in-memory SQLite wired through the real `SCHEMA` + `migrate()`:
  create/finalize (keep-with-segments vs delete-empty), `upsert_segment` idempotence,
  `list_sessions` ordering + counts, translation round-trip, `rename_speaker` (label +
  NULL group), settings round-trip, chat append/clear ordering, FTS `search_sessions`
  (match, snippet, empty query, multi-line count), and `to_fts_query` tokenization.

## Decisions

- `useElapsedTimer`: extracted/exported the pure `formatElapsed` helper (was private
  `format`) so its formatting is unit-tested; behavior unchanged.
- DB tests build `Db` from an in-memory connection inside the module's own test
  submodule (which can see the private field) — no test-only API added to production,
  no disk I/O. WAL pragma is a harmless no-op on `:memory:`.
- `lib/platform.ts` (env-detected at import) and `lib/ipc.ts` (thin invoke wrappers)
  were intentionally skipped — testing them would test the mock/environment.

## Verification

`bun test` (24 ✓) · `cargo test` (25 ✓) · `bun run build` (exit 0) ·
`cargo clippy --all-targets -- -D warnings` (clean) · `bun run lint` (0 errors).
