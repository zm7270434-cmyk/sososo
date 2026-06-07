# Platform support

sososo runs on **Windows 10/11**, **macOS 11+**, and **Linux** (PulseAudio or
PipeWire). Most of the app is shared; the differences are concentrated in audio
capture, window chrome, and packaging.

## At a glance

| Concern              | Windows                               | macOS                                               | Linux                                                   |
| -------------------- | ------------------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| System-audio capture | WASAPI **loopback** (no setup)        | No native loopback → **virtual device** (BlackHole) | Sink **monitor** source (PulseAudio/PipeWire, no setup) |
| Audio backend crate  | `wasapi` (polling, MTA-COM)           | `cpal` (CoreAudio; downmix + resample)              | `libpulse` (PA converts server-side; no resampler)      |
| Device id            | Stable WASAPI endpoint id             | cpal device **name** (no stable id)                 | PA source / monitor-source **name**                     |
| Output device list   | Render endpoints (to loopback)        | Input devices (the virtual source)                  | Sink monitor sources                                    |
| Keychain             | Credential Manager (`windows-native`) | macOS Keychain (`apple-native`)                     | Secret Service (`sync-secret-service`)                  |
| Window chrome        | Frameless, custom titlebar            | Native overlay titlebar + traffic lights            | Frameless, custom titlebar (like Windows)               |
| Mic permission       | Implicit                              | Prompted on first record; `Info.plist`              | Implicit (PulseAudio/PipeWire)                          |
| Bundle               | `.exe` / `.msi`                       | universal `.dmg` / `.app`                           | `.deb` / `.AppImage` / `.rpm`                           |

## Audio capture

This is the biggest difference; see [Audio pipeline](./audio-pipeline.md) for the
full flow.

- **Windows** — WASAPI captures a _render_ (output) device in loopback mode for
  system audio, and an _input_ device for the mic. `autoconvert` yields the
  16 kHz/16-bit/mono target directly. Polling mode is mandatory (loopback is
  incompatible with event callbacks). WASAPI requires an **MTA COM apartment**, so
  capture and device enumeration run on dedicated threads that call
  `initialize_mta()`.
- **macOS** — there is **no per-output loopback**. Both the mic and the
  "system audio source" are ordinary **input** devices; the user routes their
  output into a virtual device (BlackHole) and selects it as the system source.
  cpal delivers the device's native format, so the backend **downmixes to mono and
  resamples to 16 kHz** itself (`downmix_to_mono` + `LinearResampler` in
  [`capture/macos.rs`](../src-tauri/src/audio/capture/macos.rs)).
- **Linux** — no virtual device needed: every output **sink** exposes a `.monitor`
  source, so the backend records the default sink's monitor (or a chosen one) for
  system audio and a normal PA source for the mic. PulseAudio/PipeWire converts to
  the 16 kHz/16-bit/mono target server-side, so — like WASAPI `autoconvert` — **no
  software resampling is needed** ([`capture/linux.rs`](../src-tauri/src/audio/capture/linux.rs);
  shared introspection in [`pulse.rs`](../src-tauri/src/audio/pulse.rs)).

> cpal has no stable endpoint id, so on macOS the device **name** is used as the
> id (capture resolves devices by name). A `TODO` notes migrating to cpal's
> stable `id()`/`description()`.

## macOS system audio setup

macOS can't capture system audio without a virtual loopback device:

1. Install [BlackHole](https://github.com/ExistentialAudio/BlackHole)
   (`brew install blackhole-2ch`) or any equivalent.
2. In **Audio MIDI Setup**, create a **Multi-Output Device** combining your
   speakers/headphones **and** "BlackHole 2ch"; set it as the system output so you
   still hear audio while it's also routed to BlackHole.
3. In sososo → **Settings → Audio Devices**, pick your microphone and choose
   **BlackHole 2ch** as the system-audio source.
4. On the first recording, macOS prompts for **microphone** access — allow it.

On Windows none of this is needed — WASAPI loopback captures the chosen output
device directly.

## Linux system audio

Nothing to install. PulseAudio and PipeWire expose a **monitor** source for every
output sink, so sososo records "what you hear" directly:

1. In sososo → **Settings → Audio Devices**, pick your microphone.
2. Leave the system-audio source on its default (the default output's monitor), or
   pick a specific **Monitor of …** entry to capture a different output.

No virtual device and no manual routing — it works out of the box on any
PulseAudio- or PipeWire-based desktop. API keys are stored in the **Secret
Service** (GNOME Keyring / KWallet), so a keyring daemon must be running.

## Window chrome

The window config differs via a macOS overlay file. Tauri merges
[`tauri.macos.conf.json`](../src-tauri/tauri.macos.conf.json) over
[`tauri.conf.json`](../src-tauri/tauri.conf.json) on macOS builds.

|                 | Windows (`tauri.conf.json`) | macOS (`tauri.macos.conf.json`)                               |
| --------------- | --------------------------- | ------------------------------------------------------------- |
| `decorations`   | `false` (custom titlebar)   | `true`                                                        |
| `titleBarStyle` | —                           | `Overlay` + `hiddenTitle: true` (traffic lights over content) |
| `shadow`        | `false`                     | `true`                                                        |
| `transparent`   | `true`                      | `true`                                                        |

Both keep the `main` window at 1040×720 (min 380×420), centered, resizable.
Because macOS shows native traffic lights even on the shrunken recording widget,
[`RecordingView`](../src/windows/main/RecordingView.tsx) adds top padding when
`isMacOS` to keep the pill clear of them. The transparent window on macOS requires
the **`macos-private-api`** feature (enabled in `Cargo.toml` and
`tauri.conf.json`).

Linux inherits the base window config (frameless + custom titlebar, like Windows);
transparency depends on the compositor (good on GNOME/KDE, may render opaque on
bare tiling WMs).

[`lib/platform.ts`](../src/lib/platform.ts) (`isMacOS` / `isLinux`) is used **only**
for such cosmetic differences (chrome layout, copy), never for behavior.

## macOS entitlements & Info.plist

- [`Info.plist`](../src-tauri/Info.plist) — `NSMicrophoneUsageDescription`, the
  text shown in the macOS mic-permission prompt.
- [`Entitlements.plist`](../src-tauri/Entitlements.plist) —
  `com.apple.security.device.audio-input` (mic + virtual loopback input access);
  referenced from `tauri.conf.json` `bundle.macOS.entitlements`.
- `bundle.macOS.minimumSystemVersion: "11.0"`.

## Building per platform

The audio backends are `cfg`-gated, so each compiles only on its own OS. CI and
the release workflow build on Windows, macOS, and Linux. See
[Build & release](./build-and-release.md).

## Related

- [Audio pipeline](./audio-pipeline.md) · [Security & configuration](./security-and-config.md)
- Background: [`.development-history/2026-06-06-macos-cross-platform-support.md`](../.development-history/2026-06-06-macos-cross-platform-support.md)
