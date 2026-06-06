# Development

How to set up the repo, run the app, verify changes, and follow the project
conventions.

## Prerequisites

- **[Bun](https://bun.sh)** — the package manager. **Do not use npm/yarn/pnpm.**
- **[Rust](https://rustup.rs)** — stable toolchain, with `rustfmt` + `clippy`
  components. `cargo` is invoked for you by `bun run tauri *`.
- **Windows 10/11** with [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)
  (preinstalled on current Windows), **or macOS 11+** with Xcode Command Line
  Tools (`xcode-select --install`).
- macOS only: a virtual loopback device for system audio — see
  [Platform support → BlackHole](./platform-support.md#macos-system-audio-setup).

```sh
bun install            # install frontend deps
bun run tauri dev      # run the full desktop app (Rust + WebView)
```

## Commands

Run from the repo root unless noted.

| Task                                   | Command                                                    |
| -------------------------------------- | ---------------------------------------------------------- |
| Run the full desktop app (dev)         | `bun run tauri dev`                                        |
| Frontend only (browser, no Tauri APIs) | `bun run dev` → http://localhost:1420                      |
| Typecheck + build frontend             | `bun run build` (`tsc` then `vite build`)                  |
| Build the installer/bundle             | `bun run tauri build`                                      |
| Format everything (Prettier)           | `bun run format`                                           |
| Prettier check (CI gate)               | `bun run format:check`                                     |
| Format Rust (rustfmt)                  | `bun run fmt:rust`                                         |
| rustfmt check (CI gate)                | `bun run fmt:rust:check`                                   |
| Rust check / lint                      | `cargo check` · `cargo clippy` (from `src-tauri/`)         |
| Audio capture smoke test               | `cargo run --example audio_probe -- 6` (from `src-tauri/`) |

> Running the UI with plain `bun run dev` works for layout/styling, but Tauri
> APIs (commands, events, window control) no-op or are unavailable — the helpers
> in `lib/window.ts` guard against this so handlers don't throw.

## Verifying changes

There is **no unit-test framework**. Verification is:

1. **`bun run build`** — TypeScript typecheck + Vite build. TS is **strict** with
   `noUnusedLocals` / `noUnusedParameters`, so unused vars/params **fail the
   build**.
2. **`cargo check`** / **`cargo clippy`** (from `src-tauri/`) — Rust compiles and
   is lint-clean. Note the audio backends are `cfg`-gated per OS, so each only
   compiles on its own platform; CI runs clippy on both Windows and macOS (see
   [Build & release](./build-and-release.md)).
3. **`audio_probe`** — confirms the capture pipeline runs and both channels carry
   audio (writes `audio_probe.wav`, prints per-channel RMS). See
   [Audio pipeline → Verification](./audio-pipeline.md#verification--audio_probe).

Run the relevant subset for your change (frontend → 1; Rust → 2; audio → 3).

## Formatting (enforced)

Formatting is automated and **enforced by a Husky pre-commit hook**
(`lint-staged`):

- **Web** (`.ts/.tsx/.js/.json/.jsonc/.css/.md/.html/.yml/.yaml`) → Prettier,
  including Tailwind class sorting (`prettier-plugin-tailwindcss`).
- **Rust** (`src-tauri/**/*.rs`) → `rustfmt --edition 2021`.

Config: [`.prettierrc.json`](../.prettierrc.json),
[`src-tauri/rustfmt.toml`](../src-tauri/rustfmt.toml),
[`.editorconfig`](../.editorconfig), [`.gitattributes`](../.gitattributes) (LF
line endings). `bun run prepare` installs the hook (`husky`).

## Conventions

- **Language:** all user-facing UI strings, code, identifiers, and commit
  messages are **English**. The AI summary is generated in English by default
  (configurable per session).
- **Bun only** — never npm/yarn/pnpm.
- **Multi-agent repo:** more than one agent may work here, sometimes in parallel.
  Touch only files in your task scope, keep each commit to one focused change,
  never bundle unrelated edits, and pull/rebase before pushing.
- **Conventional Commits:** `feat(scope): …`, `fix(scope): …`, `docs(…)`,
  `chore(…)`, `refactor(…)`, `style(…)`, `ci(…)`.
- **Development history:** document each work activity as a terse Markdown report
  in [`.development-history/`](../.development-history) (goal, key changes,
  decisions, verification) — it doubles as the project knowledge base.

## Project layout

```
sososo/
├─ src/                     # React frontend
│  ├─ AppRouter.tsx · main.tsx
│  ├─ windows/main/         # MainApp, RecordingView, Titlebar, Sidebar, routes/
│  ├─ hooks/ · state/ · lib/ · types/ · styles/
├─ src-tauri/               # Rust backend (Tauri)
│  ├─ src/                  # lib.rs, commands.rs, session.rs, audio/, db.rs, ai.rs, keys.rs, …
│  ├─ examples/audio_probe.rs
│  ├─ capabilities/main.json
│  ├─ tauri.conf.json · tauri.macos.conf.json · Cargo.toml
├─ docs/                    # ← this documentation
├─ .development-history/    # per-feature change reports
└─ .github/workflows/       # ci.yml · release.yml
```

See [Architecture](./architecture.md) for what each module does.

## Related

- [Build & release](./build-and-release.md) · [Architecture](./architecture.md)
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — the contributor-facing version of this.
