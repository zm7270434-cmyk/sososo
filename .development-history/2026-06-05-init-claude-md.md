# Init CLAUDE.md — Codebase Analysis & Documentation

- **Date:** 2026-06-05
- **Task:** `/init` — analyze the repository and (re)generate `CLAUDE.md` for future Claude Code sessions.
- **Author:** Claude Code (Opus 4.8)

## Goal

Replace the minimal project `CLAUDE.md` (which only carried the `.development-history` rule) with a
high-signal guide covering common commands and the big-picture architecture, while **preserving** the
existing development-history rule.

## What was analyzed

Read the full source tree (frontend `src/`, Tauri backend `src-tauri/src/`) plus build/config files:

- **Config:** `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src-tauri/Cargo.toml`,
  `src-tauri/tauri.conf.json`, `src-tauri/capabilities/*.json`.
- **Backend (Rust):** `lib.rs`, `main.rs`, `commands.rs`, `events.rs`, `session.rs`, `state.rs`,
  `error.rs`, `keys.rs`, `audio/{mod,capture,mixer,devices}.rs`, `examples/audio_probe.rs`.
- **Frontend (TS/React):** `main.tsx`, `AppRouter.tsx`, `lib/{ipc,events,window}.ts`,
  `state/{session,transcript,config}Store.ts`, `hooks/{useSession,useTranscriptStream,useElapsedTimer}.ts`,
  `types/domain.ts`, `windows/main/*`, `windows/overlay/*`.

## Key findings (captured in CLAUDE.md)

1. **Project:** `sososo` — Windows real-time meeting/audio transcription app. Captures system audio
   (WASAPI loopback) + mic → Deepgram live STT → frosted-glass overlay + main window. UI in Bahasa Indonesia.
2. **Stack:** Tauri 2 (Rust) + React 19 / React Router 7 / Zustand 5 / Vite 7 (TS). Package manager is **Bun**.
3. **Two-window, one-build model:** `HashRouter` fragment (`#/main`, `#/overlay`) selects the shell;
   overlay is built at runtime in `lib.rs setup()` so acrylic applies before first paint.
4. **Audio pipeline:** dedicated MTA threads → WASAPI polling + autoconvert (16 kHz/16-bit/mono) →
   bounded crossbeam (drop-on-lag) → `Interleaver` (mic=ch0 "you", system=ch1 "remote") → 40 ms tokio
   bridge → `futures::mpsc` → Deepgram (Nova-3 multi/en, Nova-2 others).
5. **IPC/events:** commands in `commands.rs` (registered in `lib.rs`), TS wrappers in `lib/ipc.ts`,
   camelCase↔snake_case auto-mapping; global `session://state` + `transcript://segment` events; segments
   upserted by stable `segmentId`.
6. **Secrets:** API keys in Windows Credential Manager via `keyring`; only `has_api_key` boolean exposed.
7. **Verification:** no unit-test framework. `bun run build` (TS), `cargo check`/`cargo clippy`, and the
   `audio_probe` example.
8. **Milestones:** A (UI), B (audio), C (live STT) done; **D (SQLite persistence)** and
   **E (AI summary / OpenAI)** pending — `start_session` `title` and the OpenAI key are placeholders.

## Environment notes

- `bun` 1.3.10 on PATH.
- `cargo` 1.96.0 installed via rustup at `~/.cargo/bin` (not on the default shell PATH; invoked through
  `bun run tauri *`).
- Repository is **not** a git repo at time of writing.

## Files changed

- `CLAUDE.md` — rewritten with project overview, commands table, architecture, conventions/gotchas;
  retained the `.development-history` rule.
- `.development-history/2026-06-05-init-claude-md.md` — this report (folder created).
