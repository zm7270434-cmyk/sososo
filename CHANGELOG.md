# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-06-07

### Added

- **Linux support.** The app now builds and runs on Linux (PulseAudio or
  PipeWire). System audio is captured automatically from the default output's
  **monitor** source — no virtual device or routing needed (unlike macOS), the
  same zero-setup experience as Windows. Captured via `libpulse`, which converts
  to the 16 kHz/16-bit/mono transcription format server-side. API keys are stored
  in the Secret Service (GNOME Keyring / KWallet). Release artifacts: `.deb` /
  `.AppImage` / `.rpm`.

### Changed

- CI and the release workflow now build on Linux (`ubuntu-latest`) in addition to
  Windows and macOS.

## [0.3.1] - 2026-06-07

### Changed

- Documentation: the README now documents **Google Gemini** as a selectable AI
  provider alongside OpenAI (for both session summaries and live translation),
  with provider-selection and key-setup steps and a Google AI Studio key link.
  Added a developer/architecture reference under `docs/`.

> No application code changed since 0.3.0 — Gemini support shipped in 0.3.0; this
> release brings the user-facing docs in line with it.

## [0.3.0] - 2026-06-06

### Added

- **macOS support (experimental / alpha).** The app now builds and runs on
  macOS 11+. System audio is captured via cpal/CoreAudio using a virtual device
  such as BlackHole (see the README setup), with native traffic-light window
  controls. The macOS build is published as **"sososo Alpha"** while it is
  validated on real hardware; the Windows build is unchanged.
- Gemini as a selectable AI provider alongside OpenAI, for session summaries and
  live translation (Settings → Active AI provider).
- Settings: a Deepgram API-key help link and a note about the $200 of free
  credit for new accounts.

### Fixed

- The start-transcription screen now scrolls when its content is taller than the
  window (e.g. with live-translate expanded or a larger UI scale).

## [0.2.0] - 2026-06-06

### Added

- About page: app overview, version, a link to the GitHub repository, and a
  request to star the project.
- Configurable AI summary output language, persisted across sessions.
- Rename speaker labels from a session's history (applied across the session).
- Adjustable background transparency for the glass UI (Settings → Appearance).

### Changed

- New brand identity: the sososo bullseye app icon (window, taskbar, and
  installer) plus the wordmark logo in the titlebar; README and favicon updated
  to match.

## [0.1.0] - 2026-06-06

First public release. **Windows only** — macOS and Linux are not yet tested.

### Added

- WASAPI system-audio + microphone capture, mixed into diarized channels
  ("you" / "remote").
- Deepgram live speech-to-text with interim and finalized captions
  (Nova-3 for multilingual/English, Nova-2 otherwise).
- Live translation of the transcript to a chosen target language via OpenAI.
- Transparent "liquid glass" UI with a compact, always-on-top recording widget
  (pause / finish).
- SQLite session persistence with library and history views.
- AI session summaries via OpenAI.
- Bring-your-own-key settings (Deepgram, OpenAI) stored in the Windows
  Credential Manager.
- Open-source project setup: MIT license, README, SECURITY/PRIVACY policies,
  CONTRIBUTING, Code of Conduct, and issue/PR templates.
- Formatting SOP — Prettier (with Tailwind class sorting) + rustfmt, enforced by
  a Husky pre-commit hook — plus CI and a Windows release workflow.

[unreleased]: https://github.com/yusupsupriyadi/sososo/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/yusupsupriyadi/sososo/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/yusupsupriyadi/sososo/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/yusupsupriyadi/sososo/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/yusupsupriyadi/sososo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yusupsupriyadi/sososo/releases/tag/v0.1.0
