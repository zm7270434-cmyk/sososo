# System tray + global hotkey + meeting auto-detection

**Goal:** make recording survive (and start from) the background — tray with
close-to-tray, a global start/stop shortcut, and a "meeting detected → record?"
prompt. Three commits: `feat(tray)` 841c36e, `feat(hotkey)` 1439c26,
`feat(meeting)` 0e0a069.

## Tray + close-to-tray (`tray.rs`)

- `TrayIconBuilder` (cargo feature `tray-icon`), app icon, Open/Quit menu;
  left-click → unminimize+show+focus. CI already installs
  `libayatana-appindicator3-dev` on Linux legs — no workflow change needed.
- Close-to-tray: `on_window_event` → `CloseRequested` → `prevent_close()` +
  `hide()` when `AppState.close_to_tray` (default on; synced from the new
  Settings → Behavior section via `set_close_to_tray`). Recording keeps running
  while hidden (webview + session task stay alive).
- Tray Quit with a live session: cancel token, hide window, then `app.exit(0)`
  after a 1.5 s grace thread so the DB row/video finalize.

## Global hotkey (`hotkey.rs`)

- `tauri-plugin-global-shortcut`, Rust-side only (no JS API/capability).
  Combo **Ctrl+Alt+R** (macOS **Ctrl+Cmd+R**) — deliberately NOT Ctrl+Shift+R /
  Cmd+Opt+R (browsers' hard reload).
- Press → if no active session, `show_main_window` first (widget must be
  visible) → emit `recording://toggle`. Frontend maps it via pure
  `toggleActionFor(state)`: start (idle/stopped/error), stop
  (recording/reconnecting), ignore (starting/stopping) — unit-tested; shared
  with `useSession` start/stop (extracted to `lib/recordingToggle.ts`).
- Settings toggle un-/re-registers the OS hook (idempotent via
  `is_registered`); registration failure (combo taken) logs, non-fatal.
- **Fallback chain (found via dev smoke run):** this machine already had
  Ctrl+Alt+R registered by another app → register the first available of
  [primary, +Shift variant]; `get_active_shortcut` reports the live combo and
  Settings renders it (or an "unavailable" warning when both are taken).
  Candidate/label/matching fns are pure + unit-tested.

## Meeting auto-detection (`meeting.rs`, Windows-only enumeration)

- Pure matcher over `(app, title)` pairs, 11 unit tests: native Zoom/Teams need
  a meeting-ish title (idle clients must not prompt), Webex meeting processes
  (`atmgr`, `CiscoCollabHost`) match by name alone, browser tabs match
  "google meet" / Meet code `xxx-xxxx-xxx` (manual 3-4-3 scan, no regex dep) /
  "zoom meeting" / "microsoft teams" / "webex". Own app excluded; native beats
  browser.
- Enumeration: `video::list_windows_meta()` = existing enumeration minus
  thumbnails (cheap, pollable). macOS detection deliberately disabled —
  polling `SCShareableContent` would trigger the TCC screen-recording prompt.
- Frontend: `useMeetingDetection` polls 5 s only while
  `toggleActionFor(state) === 'start'` && enabled && Windows. `meetingStore`
  (unit-tested) handles appear→notify-once, dismiss→snooze-until-gone,
  gone→reset, other-platform-breaks-snooze. `MeetingBanner` (UpdateBanner
  pattern) offers one-click start; starting also snoozes so the prompt doesn't
  reappear right after the recording ends. OS toast via
  `tauri-plugin-notification` (Rust-side `notify` command) when unfocused.

## Decisions / gotchas

- zustand `persist` checks `window.localStorage` — bun tests stub **both**
  `globalThis.localStorage` and `globalThis.window.localStorage` before a
  dynamic `import()` of the store.
- PS 5.1 mangles multi-line `git commit -m @'…'@` (parsed as pathspecs) — use
  the Bash tool with a heredoc; also `2>&1` on native exes fakes failures.
- Settings → Behavior section is new (`BehaviorSection.tsx`); meeting checkbox
  renders only where supported (`MEETING_DETECTION_SUPPORTED`).

## Verification

- `cargo test` 51 pass (40 + 11 matcher); `cargo clippy --all-targets -D
warnings` clean; `bun test` 62 pass (incl. new configStore/meetingStore/
  recordingToggle suites); `bun run build` clean; `bun run tauri dev` smoke:
  app starts, tray + shortcut registered, no panic. Visual tray/hotkey/toast
  interactions need a manual pass on a real desktop.
