# Settings: Deepgram-vs-AI clarity + titlebar maximize button

Two small UI changes (committed separately).

## 1. Settings — Deepgram required vs optional AI keys

**Goal:** Users confused Deepgram with the OpenAI/Gemini keys and filled in only
one, thinking they were alternatives. Deepgram is mandatory for the core
transcription feature.

- `SettingsRoute.tsx`: added a callout at the top of the API Keys section —
  "Deepgram and the AI keys are two different services, not alternatives";
  "Deepgram is required" (core feature) vs the AI keys are "optional" (summaries
  - live translation).
- Split the flat key list into two labelled sub-groups: **Speech-to-text engine**
  (badge `Required`) → Deepgram; **AI summaries & translation** (badge `Optional`)
  → OpenAI/Gemini + active-provider + auto-summarize, with a "skip if you only
  need transcription" note.
- New style consts `SUBHEAD`, `BADGE_REQ` (accent), `BADGE_OPT` (faint). No CSS
  file changes — utility classes only.

## 2. Titlebar — maximize/restore button

**Goal:** Add a maximize control to the custom titlebar (minimize already
existed).

- `Titlebar.tsx`: new maximize/restore button between Minimize and Close
  (Windows/Linux only; macOS keeps native traffic lights). Icon + tooltip swap
  on `maximized` state. `useEffect` seeds state via `isMaximizedSelf()` and
  subscribes to `onWindowResized` so OS gestures (double-click drag region,
  Win+Up) keep it in sync.
- `lib/window.ts`: `toggleMaximizeSelf()`, `isMaximizedSelf()`,
  `onWindowResized(cb)` — all guarded for non-Tauri (`vite dev`).
- `lib/icons.ts`: `IconMaximize` (Square01Icon), `IconRestore` (Copy01Icon).
- `capabilities/main.json`: granted `toggle-maximize`, `maximize`, `unmaximize`,
  `is-maximized`.

## Verification

- `bun run build` ✓ (tsc strict + vite).
- `cargo check` ✓ (capability permissions accepted).
