# Cross-platform: add Linux support (PulseAudio/PipeWire via libpulse)

- **Date:** 2026-06-07
- **Scope:** App now builds & runs on **Linux** in addition to Windows + macOS. Only the audio subsystem
  and per-OS deps/packaging needed work; everything else (Deepgram, OpenAI/Gemini, SQLite, IPC, UI,
  window chrome) was already portable. Follows the additive `#[cfg(target_os)]` pattern macOS introduced.

## Goal

Make `sososo` work on Linux. Same hard constraint as macOS: developed on Windows with **no Linux machine
to runtime-test**, and Linux **can't be cross-compiled from Windows** → the Linux backend is `cfg`-gated,
so it only compiles on Linux and is verified by CI (`ubuntu-latest`, clippy `--all-targets`).

## Decisions (user-approved)

- **System audio on Linux = automatic PulseAudio/PipeWire monitor.** Every output sink exposes a
  `.monitor` source, so we record the default sink's monitor (or a user-picked one) — **zero setup**,
  like Windows WASAPI loopback (better than macOS's BlackHole requirement). Chosen over the
  "mirror-macOS / cpal-only" option, which can't cleanly enumerate monitors via ALSA.
- **libpulse for both mic and loopback (not cpal).** cpal on Linux is ALSA-only (`HostInner` has no
  PulseAudio host), so it can't enumerate monitor sources. libpulse also converts to our target spec
  server-side, so — unlike macOS — **no resampler/downmix is needed**.
- **Keyring = Secret Service, not keyutils.** `sync-secret-service` + `crypto-rust` (persistent via
  GNOME Keyring/KWallet, pure-Rust crypto, no OpenSSL). keyutils is in-memory only → unfit for API keys.
- **Window chrome = same as Windows** (frameless + custom titlebar); no `tauri.linux.conf.json` override.

## Research (context7 / web)

- **cpal 0.17:** Linux host is ALSA only (no PulseAudio backend) → use libpulse directly.
- **libpulse-binding / libpulse-simple-binding 2.x** (`jnqnfe/pulse-binding-rust`): Simple blocking
  record API + standard mainloop introspection. Aliased as `pulse` / `psimple`. Build needs
  `libpulse-dev`; runtime needs `libpulse0` (or PipeWire-pulse).
- **keyring 3.6:** `["sync-secret-service", "crypto-rust"]` is the persistent, OpenSSL-free Linux config.

## Changes

**Backend (Rust):**

- `audio/capture/linux.rs` (new) — libpulse-simple record stream for mic (PA source) + system audio
  (sink monitor, default sink's monitor when none chosen). Spec `S16le/16 kHz/mono` so PA converts;
  blocking ~40 ms reads forward `Vec<i16>` and re-check the stop flag. No resampler.
- `audio/devices/linux.rs` (new) — enumerates non-monitor PA sources (mics) + per-sink monitors
  (system audio) via introspection; source/monitor name is the id.
- `audio/pulse.rs` (new, cfg-gated) — shared one-shot introspection (standard mainloop + iterate):
  server defaults, source/sink listing, default-monitor resolution.
- `audio/capture/mod.rs`, `audio/devices/mod.rs`, `audio/mod.rs` — add `#[cfg(target_os = "linux")]`
  dispatch + `mod pulse`. Public contract (16 kHz/16-bit/mono i16) unchanged → mixer/session/commands/
  audio_probe untouched.
- `Cargo.toml` — `[target.'cfg(target_os = "linux")'.dependencies]`: `pulse` (libpulse-binding),
  `psimple` (libpulse-simple-binding), `keyring(sync-secret-service, crypto-rust)`.

**Config / packaging:**

- `tauri.conf.json` — `bundle.linux` (`deb.depends`: webkit2gtk + gtk3 + libpulse0; `appimage`). No
  override file (Linux inherits the base frameless/transparent/custom-titlebar window, like Windows).

**Frontend (TS/React):**

- `lib/platform.ts` — add `isLinux` (cosmetic only). `SettingsRoute.tsx` — keychain copy
  (Secret Service) + a Linux system-audio hint (automatic monitor capture). `Titlebar.tsx`/
  `RecordingView.tsx` unchanged (Linux takes the `!isMacOS` path = custom titlebar).

**CI/CD:**

- `ci.yml` + `release.yml` — add `ubuntu-latest` to the matrix with a step installing
  `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf libpulse-dev`.
  Clippy `--all-targets` on Ubuntu compiles + verifies the Linux backend; release builds `.deb`/`.AppImage`/`.rpm`.

**Docs:** `README.md`, `docs/{platform-support,audio-pipeline,build-and-release,development}.md`, project
`CLAUDE.md` — document Linux everywhere macOS/Windows appear.

## Verification

- **Windows (local):** `cargo fmt --check`, `cargo clippy --all-targets`, `bun run build`,
  `bun run format:check` — green. Linux code is `cfg`-gated out on Windows, so this only confirms the
  shared `mod.rs`/`Cargo.toml` edits didn't break the Windows build (Linux deps aren't even fetched).
- **Linux (CI):** verified by the new `ubuntu-latest` job compiling `capture/linux.rs` + `devices/linux.rs`.
  ⚠️ Linux code never compiled locally — CI is the source of truth.
- **Linux (manual, needs a Linux user):** install the `.deb`/AppImage → set Deepgram key → start a
  session → confirm mic + system-audio captions → check glass transparency, custom titlebar, floating widget.

## Follow-ups

- Version bump (→ 0.4.0) + tag/release after merge.
- Optional ALSA-only fallback for systems without PulseAudio/PipeWire.
- PipeWire-native capture; code signing.
