# Frontend

The React 19 single-page app rendered in the Tauri WebView: routing, state,
hooks, the UI surfaces, and the "liquid glass" styling.

## Entry & routing

`src/main.tsx` mounts [`AppRouter`](../src/AppRouter.tsx), which uses a
**`HashRouter`** (the window loads `index.html#/main`). Everything routes to
[`MainApp`](../src/windows/main/MainApp.tsx); unknown paths redirect to `/main`.

[`MainApp`](../src/windows/main/MainApp.tsx) is the hub:

1. Mounts `useTranscriptStream()` **once** (global event subscription).
2. Reads session state and decides the view:
   - **In session** (`starting`/`recording`/`stopping`/`reconnecting`) →
     renders `RecordingView` (its own root; no titlebar/sidebar).
   - **Idle** → renders the shell: `Titlebar` + `SessionSidebar` + routed
     `<main>` content.
3. On `stopped`, navigates to `/main/session/:id` if anything was transcribed,
   else `/main`.
4. Writes the `--glass-alpha` CSS variable from the transparency pref so all
   glass surfaces react live, and applies `uiScale` as CSS `zoom` on the shell.

### Routes (idle shell)

| Path                | Component                                                                 | Purpose                                                          |
| ------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `/main` (index)     | [`LibraryRoute`](../src/windows/main/routes/LibraryRoute.tsx)             | Start-a-transcription screen (device/language pickers) + home.   |
| `/main/settings`    | [`SettingsRoute`](../src/windows/main/routes/SettingsRoute.tsx)           | API keys, devices, AI provider, summary language, appearance.    |
| `/main/session/:id` | [`SessionDetailRoute`](../src/windows/main/routes/SessionDetailRoute.tsx) | A saved session: transcript, rename, AI summary, speaker rename. |
| `/main/about`       | [`AboutRoute`](../src/windows/main/routes/AboutRoute.tsx)                 | App overview, version, repo link.                                |

[`SessionSidebar`](../src/windows/main/SessionSidebar.tsx) lists session history;
it is mounted persistently (outside `<Routes>`), so it refetches via the
`libraryStore` revision bump rather than remounting.

## State (Zustand)

Four small stores in [`src/state/`](../src/state):

### `sessionStore`

The session state machine plus pause/elapsed accounting.

- `state`, `sessionId`, `startedAt`, `error`.
- `paused`, `pausedAt`, `pausedTotalMs` — pause time is excluded from the elapsed
  timer. `setPaused(b)` keeps the accounting consistent; `patch()` applies partial
  updates (driven by the `session://state` event).

### `transcriptStore`

- `segments: Segment[]` — `upsert(seg)` inserts or replaces by `segmentId`
  (interim → final in place).
- `translations: Record<segmentId, TranslationEntry>` — per-segment live
  translation cache (`status: pending | done | error`, plus `forText`/`lang` so an
  unchanged line is never re-translated).
- `reset()` clears both (called when a session starts).

### `configStore` (persisted)

Persisted to `localStorage` under **`sososo-config`**. `partialize` persists
**only** appearance + translation prefs:

| Field                          | Default   | Bounds        | Persisted?             |
| ------------------------------ | --------- | ------------- | ---------------------- |
| `uiScale`                      | `1`       | `0.8`–`1.4`   | ✅                     |
| `transcriptScale`              | `1`       | `0.8`–`1.6`   | ✅                     |
| `glassOpacity`                 | `0.58`    | `0.15`–`0.95` | ✅                     |
| `translateEnabled`             | `false`   | —             | ✅                     |
| `targetLanguage`               | `'en'`    | —             | ✅                     |
| `language`                     | `'multi'` | —             | ❌ (synced to backend) |
| `systemOnly`                   | `false`   | —             | ❌ (synced to backend) |
| `inputDevice` / `outputDevice` | `null`    | —             | ❌ (synced to backend) |

> Device/language/`systemOnly` live in the store for the current run but are
> **pushed to the backend** (`setDevices`, `setTranscriptionOptions`) rather than
> persisted on the frontend — the backend `AppState` holds them in memory, so
> these reset to defaults on app restart.

### `libraryStore`

A single `revision` counter; `refresh()` bumps it to invalidate the cached
history list (used after delete/rename so the persistent sidebar reloads).

## Hooks

| Hook                                                         | Role                                                                                                                                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`useTranscriptStream`](../src/hooks/useTranscriptStream.ts) | Subscribes to both backend events and pipes them into the stores. **Mount once.**                                                                                                                                  |
| [`useSession`](../src/hooks/useSession.ts)                   | `start` / `stop` / `togglePause` with **optimistic** state; backend events refine it. Pause reverts on failure.                                                                                                    |
| [`useLiveTranslation`](../src/hooks/useLiveTranslation.ts)   | For each finalized line (when enabled), marks it `pending` **synchronously**, calls `translateSegment`, stores the result; skips already-translated lines and ignores stale responses. Mount from `RecordingView`. |
| [`useElapsedTimer`](../src/hooks/useElapsedTimer.ts)         | Formats the running elapsed label, excluding paused time.                                                                                                                                                          |

## IPC & events layer

- [`lib/ipc.ts`](../src/lib/ipc.ts) — thin typed wrappers over `invoke()` (one
  per command). This is the only place that names command strings.
- [`lib/events.ts`](../src/lib/events.ts) — `onSessionState` / `onTranscriptSegment`
  wrappers over Tauri `listen()`.

See the [IPC reference](./ipc-reference.md) for the full surface.

## The recording widget

[`RecordingView`](../src/windows/main/RecordingView.tsx) is the in-session UI:

- On mount, `enterRecordingWindow()` shrinks the window to **460×600**,
  always-on-top; on unmount, `exitRecordingWindow()` restores **1040×720**
  ([`lib/window.ts`](../src/lib/window.ts)).
- A pill with three icon buttons — **yellow** pause/resume, **red** finish, a
  **blue** live-translate toggle — plus a drag handle (`data-tauri-drag-region`).
- A status header (animated dot + `Recording`/`Paused`/`Finishing…` + elapsed),
  an optional "Translate to" picker, and the scrolling transcript.
- Each line shows a speaker label (colored via `speakerColor`), the text (interim
  lines italic/dimmed), and — when enabled — the translation beneath it
  (amber when done, "Translating…" while pending).

## Styling: liquid glass

Tailwind CSS v4 (`@tailwindcss/vite`, **no config file**), utility-first — all
component styling is inline utility classes. The single
[`styles/app.css`](../src/styles/app.css) holds `@import "tailwindcss"`, the
`@theme` design tokens (colors, radii, `--font-sans`, `--shadow-liquid`,
`--animate-rec-pulse`), the `rec-pulse` keyframes, the `liquid-glass` `@utility`,
and an `@layer base` reset.

- **Liquid glass** = a translucent fill + a bright glassy edge (white border,
  inset top highlight, soft inner glow). Fill =
  `rgb(28 28 34 / var(--glass-alpha, 0.58))`; `MainApp` writes `--glass-alpha`
  from `glassOpacity` so every surface reacts live.
- There is **no window blur** — a transparent window can't frost the desktop
  behind it, and native acrylic was tried and removed. The desktop shows through
  sharply; the tint is purely the CSS fill.
- **Scaling:** `uiScale` is CSS `zoom` on the shell (the shell counter-scales to
  the viewport so zoom enlarges content without overflow); `transcriptScale`
  multiplies transcript/label font sizes (live + history).
- **Speaker colors** ([`lib/speaker.ts`](../src/lib/speaker.ts)): `"You"` keeps
  the accent blue (`#6ea8fe`); each diarized remote speaker gets a distinct hue
  from an 8-color palette (by 1-based index, cycling).

## Languages

[`lib/languages.ts`](../src/lib/languages.ts) is the single source of UI language
options (BCP-47 code + label), following Deepgram's Nova-3 list. `multi`
(auto-detect) and `id` (Indonesian) are pinned on top. Derived lists:

- `TRANSLATE_TARGETS` — all languages except `multi` (not a valid target).
- `SUMMARY_LANGUAGES` — an `"auto"` option + every specific language.
- `languageLabel(code)` resolves a code to its display name (used when sending
  human-readable language names to the AI provider).

## Platform cosmetics

[`lib/platform.ts`](../src/lib/platform.ts) exposes `isMacOS` (best-effort UA
detection) for **cosmetic** differences only — e.g. extra top padding in the
recording widget to clear macOS traffic lights, and platform-specific copy. It is
never used for behavior. See [Platform support](./platform-support.md).

## Related

- [Architecture](./architecture.md) · [IPC reference](./ipc-reference.md) ·
  [Data model](./data-model.md) · [AI & translation](./ai-and-translation.md)
