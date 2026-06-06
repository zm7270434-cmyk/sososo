# Docs reference folder (`docs/`)

**Goal:** Add a contributor-facing technical documentation set under `docs/`
(beyond the product `README.md`).

## Key changes

- New `docs/` reference set (11 Markdown files), cross-linked, with Mermaid
  diagrams:
  - `README.md` — index + 60-second mental model + system diagram.
  - `architecture.md` — process/threading model, single-window state-driven
    views, module map, session lifecycle (sequence diagram).
  - `audio-pipeline.md` — capture → mix → bridge → Deepgram → emit/persist;
    per-OS backends; PCM contract; `audio_probe` verification.
  - `ipc-reference.md` — every command + the two global events + error model.
  - `data-model.md` — shared TS/Rust types + SQLite schema (ER diagram) +
    persistence lifecycle + migrations.
  - `frontend.md` — router, Zustand stores, hooks, recording widget, liquid-glass
    styling, language lists.
  - `ai-and-translation.md` — OpenAI/Gemini providers, prompts, models, idempotent
    live translation.
  - `security-and-config.md` — keychain secrets, capabilities, CSP, config tiers.
  - `development.md` — setup, commands, verification, formatting, conventions.
  - `build-and-release.md` — local build, CI matrix, tag-driven release.
  - `platform-support.md` — Windows vs macOS (audio, window chrome, entitlements).

## Decisions

- Docs written in **English** to match the repo convention (UI, code,
  `.development-history`, existing top-level docs are all English).
- Left `docs/superpowers/` (plugin-managed specs/plans) untouched.
- Documented **actual code behavior over stale prose**: `session.rs`
  `model_language()` uses **Deepgram Nova-3 for all languages** — older
  `README`/`CHANGELOG`/`CLAUDE.md` mentions of "Nova-2 for other languages" are
  outdated. Flagged in `audio-pipeline.md`.

## Verification

- `bunx prettier --check "docs/*.md"` → clean (also enforced by the husky
  pre-commit hook).
- Validated every relative file link in `docs/*.md` resolves to a real file.
- No code touched; `cargo` / `bun run build` unaffected.
