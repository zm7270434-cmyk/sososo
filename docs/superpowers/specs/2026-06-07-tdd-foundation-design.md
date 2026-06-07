# TDD Foundation + Initial Test Suite — Design

- **Date:** 2026-06-07
- **Status:** Approved (brainstorming)
- **Scope:** Establish the TDD foundation for `sososo` (which currently has **zero**
  tests) plus a meaningful initial suite over pure, isolatable logic — without
  breaking the existing build/release pipeline.

## Goal

TDD became mandatory for this project on 2026-06-07, but no tests exist yet. Stand
up the test harness on both sides (Rust `cargo test`, frontend `bun test`) and write
an initial suite covering the units `CLAUDE.md` explicitly names, so the TDD pattern
is established and there is real regression coverage from day one.

## Approach

Inline & co-located, minimal config (chosen over separate test dirs or setting up
component/DOM testing now):

- **Rust:** `#[cfg(test)] mod tests` inline next to the code under test.
- **Frontend:** `*.test.ts` co-located beside each unit, using Bun's built-in
  `bun:test` runner (no install).
- Matches the conventions already written in `CLAUDE.md`.

## Units under test (initial suite)

All pure / isolatable — no I/O, no network, no DOM.

| #   | Unit                                                   | Test location             | Behavior verified                                                                                                                                                                                                         |
| --- | ------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `audio/mixer.rs` `Interleaver`                         | inline `mod tests`        | interleave order `[mic0,sys0,mic1,sys1,…]`; `drain_*` emits only `min(mic,sys)` pairs; `bound_skew` pads the starved channel with silence past `max_skew`; LE byte format; i16 variant                                    |
| 2   | `ai.rs` `render_transcript` + `Provider::from_setting` | inline `mod tests`        | `You` / `Other (speaker N)` labeling; empty-text lines skipped; truncation marker appended past `MAX_TRANSCRIPT_CHARS`; UTF-8 char-boundary safety; setting parse `gemini`→Gemini, unknown/empty→OpenAi, case-insensitive |
| 3   | `lib/format.ts` `formatDateTime`                       | `format.test.ts`          | valid ISO → en-US formatted string; invalid ISO → input returned unchanged (NaN guard)                                                                                                                                    |
| 4   | `lib/speaker.ts` `speakerColor`                        | `speaker.test.ts`         | `you` → accent blue; `Speaker 1/2` → palette slots; cycling beyond palette length; non-numeric label → stable hash; null/undefined speaker                                                                                |
| 5   | `state/transcriptStore.ts`                             | `transcriptStore.test.ts` | `upsert` inserts new by id; `upsert` replaces in place (interim→final) preserving order; `setTranslation`; `reset` — exercised via `getState()`/`setState()`, no DOM                                                      |

## Infrastructure changes

- **`tsconfig.json`:** add `"exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]`
  so `bun run build` (`tsc`) does not compile test files into the production build —
  keeps release builds clean and immune to `bun:test` imports / strict-mode quirks.
- **`package.json`:** add devDep `@types/bun` (types for `bun:test` and editor) and a
  `"test": "bun test"` script (run via the Bash tool — PowerShell mis-resolves
  `bun run`).
- **Rust:** no config change — `cargo test` works out of the box against the lib crate.
- **Husky pre-commit:** left untouched — no test gate added to commits, so the
  auto-commit/push flow is never blocked by the runner.

## TDD method for this task

This is backfill over already-shipped code, so each test is written first and then run
— it must pass immediately (green), locking in current behavior. Any test that comes
up **red** reveals a real bug → fix it. For future features/bugfixes, the full
red-first TDD loop applies as normal.

## Verification (definition of done)

`cargo test` (green) · `bun test` (green) · `bun run build` (confirms the exclude
works and TS still compiles) · `cargo clippy` (clean). A short report is written to
`.development-history/`.

## Out of scope (deliberate)

- Component/DOM tests (React Testing Library + happy-dom) — `CLAUDE.md` defers this to
  the first task that needs a component test.
- A pre-commit test gate.
- Backfilling every other `lib/` module and Zustand store.
- I/O-bound paths (HTTP to OpenAI/Gemini, live audio capture, Deepgram round-trips) —
  covered by the manual runtime check, not unit tests.
