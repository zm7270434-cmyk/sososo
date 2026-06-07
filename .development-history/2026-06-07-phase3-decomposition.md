# Phase 3 — Decompose Oversized Modules

**Date:** 2026-06-07 · **Program:** `docs/superpowers/specs/2026-06-07-professional-hardening-design.md`

## Goal

Break the largest files into well-bounded modules, behavior-preserving, under the
Phase 1 gates + Phase 2 coverage.

## Rust (verified by `cargo test` + `cargo clippy -- -D warnings`)

- **`ai.rs` (558) → `ai/`**: `provider`, `transcript`, `openai`, `gemini`, `mod`
  (prompts + dispatch + public API). Public API re-exported from `ai/mod.rs`.
- **`db.rs` (642) → `db/`**: `mod` (type/schema/setup/migrate) + `sessions`,
  `segments`, `settings`, `chat`, `search` submodules; integration tests in
  `db/tests.rs`. Child submodules retain access to the private connection field.
- **`commands.rs` (428) → `commands/`**: `devices`, `session`, `apikeys`, `history`,
  `assistant`, re-exported from `commands/mod.rs` so `generate_handler!` keeps
  resolving `commands::<name>`.

## Frontend (verified by `tsc` + `eslint` + `vite build`; pure helpers unit-tested)

Conservative, state-independent extraction (I can't run the Tauri app here, so the
stateful cores were left intact and only leaf helpers / store-driven sections moved):

- **`SessionDetailRoute.tsx` (1158 → ~480 component)**: moved `renderInline` +
  `SummaryView` + `ChatBubble` → `sessionDetail/markdown.tsx`; `highlightText` →
  `sessionDetail/highlightText.tsx`; `distinctSpeakers`/`SpeakerEntry` →
  `sessionDetail/speakers.ts`. Added unit tests for the pure `distinctSpeakers` and
  `highlightText`.
- **`SettingsRoute.tsx` (651 → ~520)**: shared class-name constants →
  `settings/styles.ts`; the store-driven Appearance section →
  `settings/AppearanceSection.tsx`; the pure App-update status derivation →
  `settings/updateStatus.ts` (unit-tested).

## Decisions / follow-ups

- Deeper decomposition of the stateful cores (the SessionDetail data/effects, the
  Settings API-keys section) is deferred: it should be done under React component
  (DOM) test coverage — RTL + happy-dom — which is the recommended next enabler.
- Test totals after this phase: frontend 33, Rust 25.

## Verification

`bun test` (33 ✓) · `cargo test` (25 ✓) · `bun run build` (exit 0) ·
`cargo clippy --all-targets -- -D warnings` (clean) · `bun run lint` (0 errors).
