# Phase 1 — Safety Net (quality gates)

**Date:** 2026-06-07 · **Program:** `docs/superpowers/specs/2026-06-07-professional-hardening-design.md`

## Goal

Make CI enforce the quality bar so later refactors are safe and verified.

## Key changes

- **CI (`.github/workflows/ci.yml`)** — added across the 3-OS matrix:
  - `ESLint` step (`bun run lint`).
  - `Frontend tests` step (`bun test`).
  - `Rust tests` step (`cargo test`).
  - Hardened clippy: `cargo clippy --all-targets -- -D warnings` (warnings now fail CI).
- **ESLint 9/10 flat config (`eslint.config.js`)** — `@eslint/js` + `typescript-eslint`
  recommended + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`. Browser
  globals for `src`, node globals for config files, browser+node for tests. Added
  `@eslint/js`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`,
  `eslint-plugin-react-refresh`, `globals` devDeps + `"lint": "eslint ."` script.

## Decisions

- **react-hooks v7 React-Compiler rules** (`set-state-in-effect`, `purity`) downgraded
  from error → **warn**. They fire on legitimate patterns in this non-compiler codebase
  (reset-state-on-dependency-change effects; render-time `Date.now()` in
  `useElapsedTimer`). Kept visible as warnings; to be fixed properly (with tests) when
  those units are touched in later phases — not via a risky rewrite now.
- Pre-commit hook left format-only (fast, never blocks the auto-commit flow); CI is the
  thorough gate.
- 6 lint warnings remain (intentional, tracked above); 0 errors.

## Verification

`bun run lint` (0 errors, 6 warnings) · `bun test` (11 ✓) · `cargo test` (12 ✓) ·
`bun run build` (exit 0) · `cargo clippy --all-targets -- -D warnings` (clean).
