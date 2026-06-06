# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/yusupsupriyadi/sososo/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/yusupsupriyadi/sososo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yusupsupriyadi/sososo/releases/tag/v0.1.0
