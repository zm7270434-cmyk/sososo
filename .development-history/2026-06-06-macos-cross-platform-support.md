# Cross-platform: add macOS support (cpal/CoreAudio)

- **Date:** 2026-06-06
- **Scope:** App now builds & runs on **macOS** in addition to Windows. Only the audio subsystem was
  Windows-specific (WASAPI); everything else (Deepgram, OpenAI/Gemini, SQLite, UI) was already portable.

## Goal

Make `sososo` work on macOS. Hard blocker: `audio/capture.rs` + `audio/devices.rs` used the `wasapi`
crate (Windows-only). Constraint: developed on Windows with **no Mac to test**, and macOS **can't be
cross-compiled from Windows** → macOS compile is verified only via CI (`macos-latest`).

## Decisions (user-approved)

- **System audio on macOS = cpal + BlackHole.** macOS has no per-output loopback, so both mic and
  "system audio" are captured as ordinary cpal **input** devices; the system-audio source is expected
  to be a virtual device (BlackHole) the user routes their output into. Reliable & CI-verifiable;
  needs no Screen Recording permission (mic permission only). Chosen over ScreenCaptureKit (native but
  immature Rust bindings, untestable here) and mic-only (loses the headline feature).
- **Window controls on macOS = native traffic lights** via `titleBarStyle: "Overlay"`; Windows keeps
  its custom titlebar.
- **Dependency-free linear resampler** instead of `rubato`: the macOS backend only compiles in CI, so
  inspectable logic beats an untestable DSP-API dependency. Adequate quality for 16 kHz speech STT.

## Research (context7)

- **cpal** (0.17.3): `default_host()` → `default_input_device()`/`input_devices()`; `default_input_config()`
  gives native format/rate/channels; `build_input_stream::<T>(config, data_cb, err_cb, None)` with `&[T]`
  per `sample_format()` (F32/I16/U16); `Stream` is `!Send` on macOS (build/play/drop on one thread).
- **Tauri 2 macOS:** mic permission via `src-tauri/Info.plist` (`NSMicrophoneUsageDescription`, auto-merged);
  `bundle.macOS` supports `minimumSystemVersion` + `entitlements`; platform config merges per **JSON Merge
  Patch (RFC 7396)** → arrays are **replaced**, so `tauri.macos.conf.json` repeats the full window object.

## Changes

**Backend (Rust):**

- `audio/capture.rs` → `capture/{mod.rs, windows.rs, macos.rs}`; `audio/devices.rs` →
  `devices/{mod.rs, windows.rs, macos.rs}`. `mod.rs` keeps the public API + thread/crossbeam scaffolding
  and cfg-dispatches to a `#[path]` platform submodule. Public contract unchanged (16 kHz/16-bit/mono i16),
  so `mixer`/`session`/`commands` untouched.
- `capture/macos.rs` — cpal input stream; downmix-to-mono + a small stateful `LinearResampler`
  (native rate → 16 kHz, continuous across callbacks). `devices/macos.rs` — cpal enumeration; device
  **name doubles as the id** (cpal has no stable endpoint id); `list_output_devices` returns inputs.
- `Cargo.toml` — per-OS dep tables: `wasapi` + `keyring(windows-native)` under `cfg(windows)`; `cpal` +
  `keyring(apple-native)` under `cfg(macos)`. `examples/audio_probe.rs` — drop the direct
  `wasapi::initialize_mta()` (enumeration/capture init MTA themselves) so it compiles on macOS too.

**Config / packaging:**

- `tauri.conf.json` — add `bundle.macOS` (`minimumSystemVersion: "11.0"`, `entitlements`); neutral
  `longDescription`. `tauri.macos.conf.json` (new) — macOS window: `decorations:true` +
  `titleBarStyle:"Overlay"` + `hiddenTitle:true`, transparent kept. `Info.plist` (new) — mic usage string.
  `Entitlements.plist` (new) — `com.apple.security.device.audio-input`.

**Frontend (TS/React):**

- `lib/platform.ts` (new) — `isMacOS` (userAgent/platform; cosmetic only). `Titlebar.tsx` — hide custom
  controls + pad-left for traffic lights on macOS. `RecordingView.tsx` — top padding on macOS so the pill
  clears the traffic lights. `app.css` — lead `--font-sans` with `system-ui`. Copy: drop "for Windows"
  (About); "macOS Keychain" vs "Windows Credential Manager" + a BlackHole hint (Settings).

**CI/CD:**

- `ci.yml` — matrix `[windows-latest, macos-latest]` (fail-fast:false); clippy `--all-targets` on macOS is
  the macOS-backend verification gate. `release.yml` — matrix build; macOS = universal `.dmg` via
  `--target universal-apple-darwin` (+ `rustup target add` arm64/x86_64); both upload to one draft release.

## Verification

- **Windows (local):** `cargo check`/`cargo clippy --all-targets` clean (only pre-existing `mixer.rs`
  warnings); `bun run build` OK; `audio_probe -- 3` still captures both channels (sys RMS ~300). Refactor
  preserved Windows behavior.
- **macOS (CI):** verified by the new `macos-latest` job compiling the cpal backend. ⚠️ macOS code is
  cfg-gated out on Windows, so it never compiled locally — CI is the source of truth.
- **macOS (manual, needs a Mac user):** install BlackHole → Multi-Output Device → allow mic prompt → start
  session, confirm mic + system captions → check native traffic lights, glass transparency, floating widget.

## Follow-ups

- Native system audio via ScreenCaptureKit / Core Audio taps (drop the BlackHole requirement).
- Code signing + notarization (macOS) and signing (Windows) so the OS doesn't warn on first run.
- Linux backend (ALSA/PulseAudio via cpal) — the platform abstraction makes this additive.
