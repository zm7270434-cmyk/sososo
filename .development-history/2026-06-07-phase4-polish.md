# Phase 4 — Polish (supply-chain, commit hygiene, coverage)

**Date:** 2026-06-07 · **Program:** `docs/superpowers/specs/2026-06-07-professional-hardening-design.md`

## Key changes

- **Dependency auditing in CI** (`.github/workflows/ci.yml` → new `Security audit` job):
  - `bun audit` for JS/TS advisories (currently clean).
  - `cargo audit` (RustSec) for the backend, via `taiki-e/install-action`.
- **Resolved the open Dependabot alert** (`RUSTSEC-2024-0429`, glib `VariantStrIter`
  unsoundness, medium): `glib 0.18` is pinned transitively by `gtk 0.18 ← tauri 2.11`,
  so no fixed release is reachable until Tauri bumps its GTK stack, and the affected
  iterator is unused here. Dismissed as `tolerable_risk` and ignored in `cargo audit`
  (`--ignore RUSTSEC-2024-0429`) so CI still catches _new_ advisories. Revisit on the
  next Tauri bump.
- **Conventional Commits enforcement** (new `Commit lint` CI job via
  `wagoid/commitlint-github-action`; config `commitlint.config.js` extends
  `@commitlint/config-conventional`). Enforcement is CI-only by choice: it needs no
  extra `@commitlint/*` devDeps and can't block local commits if misconfigured.
  (Husky already runs `lint-staged` on `pre-commit`; a `commit-msg` hook could be
  added later if local feedback is wanted.)
- **Coverage**: `bun run coverage` (`bun test --coverage`) script + `docs/testing.md`
  documenting the test/coverage/audit commands (including optional `cargo-llvm-cov`).

## Decisions

- Audit is a real CI gate (fails on new advisories) with one explicitly-documented,
  unfixable transitive ignore — not blanket-disabled.
- Commit linting is CI-only (PR + push) rather than a local hook, given the untracked
  `.husky/` state.

## Verification

`bun run coverage` (33 ✓) + the existing gates; the new `Security audit` and
`Commit lint` CI jobs are green on push.
