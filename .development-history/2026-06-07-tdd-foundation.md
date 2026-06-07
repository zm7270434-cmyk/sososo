# TDD Foundation + Initial Test Suite

**Date:** 2026-06-07 · **Spec:** `docs/superpowers/specs/2026-06-07-tdd-foundation-design.md`

## Goal

TDD became mandatory on 2026-06-07 but the repo had **zero** tests. Stand up the
test harness on both sides and add an initial suite over pure, isolatable logic.

## Key changes

- **Infra**
  - `tsconfig.json`: added `"exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]`
    so `bun run build` (`tsc`) never compiles test files into the production build.
  - `package.json`: added `@types/bun` devDep + `"test": "bun test"` script.
  - Rust: no config needed — inline `#[cfg(test)] mod tests`.
- **Frontend tests (`bun test`, 11 tests)**
  - `src/lib/format.test.ts` — `formatDateTime` (valid ISO → en-US; invalid → input
    unchanged; assertions chosen TZ-independent).
  - `src/lib/speaker.test.ts` — `speakerColor` (you→accent; numbered slots; palette
    cycling; missing label→slot 0; non-numeric→stable hashed color).
  - `src/state/transcriptStore.test.ts` — `upsert` insert/replace-in-place,
    `setTranslation`, `reset` (via `getState()`, no DOM).
- **Rust tests (`cargo test`, 12 tests)**
  - `audio/mixer.rs` — `Interleaver`: interleave order, LE bytes, min-pair drain +
    remainder, empty drain, skew padding both directions.
  - `ai.rs` — `render_transcript` (labels, blank-line skip, trim, char-boundary-safe
    truncation) + `Provider::from_setting`/`key_service`.

## Decisions

- **Backfill, so green-on-first-run.** Tests lock in current behavior; a red test
  would mean a real bug. Full red-first TDD applies to future work.
- Component/DOM testing (RTL + happy-dom), a pre-commit test gate, and I/O-bound
  paths (HTTP AI, live capture, Deepgram) are deliberately out of scope.
- Folded in a tiny test-covered clippy fix in `mixer.rs` (`repeat().take()` →
  `repeat_n()`) since the new `Interleaver` tests guard that path.

## Verification

`bun test` (11 ✓) · `cargo test` (12 ✓) · `bun run build` (exit 0 — exclude works) ·
`cargo clippy --all-targets` (clean).
