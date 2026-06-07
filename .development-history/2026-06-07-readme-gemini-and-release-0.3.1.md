# README Gemini docs + release 0.3.1

- **Date:** 2026-06-07
- **Scope:** Document Gemini in the README (it shipped in 0.3.0 but the README
  still said OpenAI-only), then cut a `0.3.1` patch release.

## Goal

User request: update the README so the AI/LLM choice clearly includes **Google
Gemini** (not just OpenAI), and publish a new `0.3.1` release.

## Changes

**README.md** — brought user-facing docs in line with the shipped code
(`ai.rs` already supports `Provider::OpenAi | Gemini`):

- Header badge: OpenAI badge + a Gemini badge.
- Intro / bring-your-own-key: summaries via OpenAI **or** Gemini; BYO key for the
  chosen provider.
- Features: "AI summaries & live translation" powered by either provider.
- Privacy at a glance: transcript goes to the selected provider (OpenAI/Gemini).
- Configure API keys: pick **Active AI provider** + paste that provider's key;
  added a Google AI Studio key link alongside the OpenAI dashboard.
- Tech stack + "Powered by": both providers listed.

**Release 0.3.1** (docs-only patch — no app code changed since 0.3.0):

- Bumped version → `0.3.1` in `package.json`, `src-tauri/tauri.conf.json`,
  `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`.
- `CHANGELOG.md`: new `[0.3.1]` section + compare links; note that Gemini support
  itself shipped in 0.3.0 and this release only catches the docs up.

## Verification

- `bunx prettier --check` (changed files) — clean.
- `cargo check` — OK (version/lock consistent).
- `bun run build` — OK (81 modules, tsc strict).

## Process

- Commits: `docs(readme): …` (README) + `chore(release): 0.3.1` (version bumps +
  CHANGELOG) + this history note.
- Annotated tag `v0.3.1` pushed → the Release workflow (`tauri-action`) builds on
  `windows-latest` + `macos-latest` and creates a **draft** GitHub Release with
  the Windows installer + macOS universal `.dmg`/`.app`; pending a manual
  **Publish**.

## Notes

- 0.3.1 binaries are functionally identical to 0.3.0 (only docs/version changed).
- Builds remain unsigned → Windows SmartScreen / macOS Gatekeeper warn on first
  run (macOS: right-click → Open). Publish via the Releases page or
  `gh release edit v0.3.1 --draft=false`.
