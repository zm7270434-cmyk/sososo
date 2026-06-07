# Professional Hardening Program — Design

- **Date:** 2026-06-07
- **Status:** Approved (brainstorming) — execute autonomously, phase by phase
- **Goal:** Raise `sososo` to a "unicorn-grade" professional bar: enforced quality
  gates, meaningful test coverage, well-bounded modules, and supply-chain/commit
  hygiene — each step behavior-preserving and verified.

## Principles

- Every phase keeps the app's behavior identical and ends green on all gates.
- Risky structural refactors (Phase 3) happen **only after** the safety net (Phase 1)
  and coverage (Phase 2) are in place.
- Work on `master`, commit per scope, push + watch CI after each phase.
- Pre-commit stays format-only (fast, never blocks the auto-commit flow); CI is the
  thorough gate.

## Phase 1 — Safety net (gates)

- `ci.yml`: add steps to run `bun test` and `cargo test` (across the existing 3-OS
  matrix).
- Clippy step becomes `cargo clippy --all-targets -- -D warnings` (warnings fail CI).
- ESLint 9 flat config (`eslint.config.js`): `typescript-eslint` (recommended) +
  `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`. Add devDeps, a
  `"lint": "eslint ."` script, and a CI **Lint** step. Fix violations surfaced in
  existing code.
- Pre-commit hook unchanged (format-only).

## Phase 2 — Coverage (TDD over isolatable pure logic)

- **Rust:** `error.rs` (`AppError` → string serialization), `db.rs` against an
  in-memory SQLite connection (session/segment/settings/chat/search CRUD), pure parts
  of `commands.rs`, more of `ai.rs` (summary language directive).
- **Frontend:** Zustand stores (`sessionStore` state machine, `configStore`,
  `libraryStore`, `updateStore`), `lib/languages.ts`, `lib/platform.ts`,
  `lib/ipc.ts` (payload mapping), `useElapsedTimer`.
- Target: meaningful coverage of pure logic, not a coverage percentage.

## Phase 3 — Decompose oversized modules (under Phase 2 coverage)

Behavior-preserving splits, tests stay green at each step:

- `SessionDetailRoute.tsx` (1158 LOC) → header / transcript list / summary panel /
  chat panel subcomponents + a data-loading hook.
- `SettingsRoute.tsx` (651) → one component per settings section.
- `db.rs` (642) → `db/` module split (sessions / segments / settings / chat / search).
- `ai.rs` (558) → provider transports (`openai`, `gemini`) + prompts + public API.
- `commands.rs` (428) → grouped by domain.

## Phase 4 — Polish

- CI: `cargo audit` (rustsec) + `bun audit` for dependency scanning; resolve the open
  Dependabot alert.
- `commitlint` + husky `commit-msg` hook enforcing Conventional Commits.
- Coverage script (`cargo llvm-cov` + `bun test --coverage`) + short docs.
- A `.development-history/` note per phase.

## Verification (every phase)

`bun test` · `cargo test` · `bun run build` · `cargo clippy --all-targets -- -D warnings`
· `eslint .` (from Phase 1 on) · CI green after push.

## Out of scope

- New product features; large observability/tracing subsystems; visual redesign.
- Rewrites that change public IPC contracts or persisted DB schema.
