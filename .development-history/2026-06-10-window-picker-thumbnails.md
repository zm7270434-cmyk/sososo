# Start screen: visual window picker with thumbnails

**Goal:** make picking the window to record easy (Zoom-style) — the old UI was a
plain `<select>` of window titles, hard to scan and easy to mispick.

## Backend (Windows)

- `WindowInfo` gains `thumbnail: Option<String>` — a small JPEG as a
  `data:image/jpeg;base64,…` URL (≤320×200, q70, ~2–15 KB each).
- `list_windows()` (windows.rs) now, per window: snapshot via **GDI
  `PrintWindow`** into a top-down 32-bpp DIB with **`PW_RENDERFULLCONTENT`**
  (flag value 2 — required for GPU-rendered windows like Chrome/Electron; not in
  the `windows` crate metadata, declared locally) → BGRA→RGB →
  `image::imageops::thumbnail` → JPEG → base64.
- Skips: minimized (`IsIconic` — stale surface), hung (`IsHungAppWindow` —
  `PrintWindow` would block), all-black output (DRM/protected → `None`,
  UI placeholder), and **our own process's windows** (`GetWindowThreadProcessId`
  vs `std::process::id()`). List is sorted by app, then title.
- TDD: `fit_thumb_size` (aspect-fit, no upscale, ≥1px) + `is_blank_bgra`
  (near-black detection) — 6 tests. Clippy `items_after_test_module`: the test
  module must be the last item in the file.
- New deps (Windows target only): `windows 0.62` (same version already in the
  tree via vendored windows-capture → no duplicate build; features Foundation /
  Gdi / Storage_Xps / WindowsAndMessaging), `image` (jpeg only), `base64`.
- API signatures verified against the actual `windows 0.62.2` sources in the
  cargo registry (PrintWindow lives in `Win32::Storage::Xps`; only
  `PW_CLIENTONLY` is exported).
- Verification example: `cargo run --example thumb_probe` (from `src-tauri/`)
  dumps every thumbnail to `thumb_probe_out/*.jpg` (gitignored) — eyeballed:
  Chrome PiP + Slack thumbnails crisp, colors correct; only TextInputHost
  (blank) correctly yielded no thumbnail. `lib.rs`: `mod video` → `pub mod`
  so the example can call it.
- macOS/unsupported backends return `thumbnail: None` (SCScreenshotManager is a
  future option).

## Frontend

- New `routes/library/WindowPickerModal.tsx`: searchable **thumbnail grid**
  (2–3 cols, aspect-video cards, app + title, selected ring + check badge),
  refresh button (spins while loading), skeleton loading state, empty/no-match
  states, Esc/backdrop/X close. All close paths funnel through one `close()`
  (resets the search; avoids a new `react-hooks/set-state-in-effect` warning).
- `LibraryRoute`: the `<select>` is replaced by a state-aware row — dashed
  **"Choose a window…"** button (none picked) / preview card (thumbnail + app +
  title + **Change**) / pulse skeleton while loading / amber **"no longer
  open"** + re-pick when the chosen window vanished. Enabling the toggle with
  nothing picked auto-opens the picker (Zoom flow). List refreshes on toggle-on
  and on every modal open.
- New `lib/windowPicker.ts` (TDD, 8 tests): `filterWindows` (case-insensitive
  over title/raw app/pretty app) + `prettyAppName` ("chrome.exe" → "Chrome").
- `types/domain.ts`: `WindowInfo.thumbnail?: string | null`.

## Follow-up: per-window vs per-tab

- User asked why Chrome tabs don't appear individually (à la Google Meet's
  "share this tab"). That picker runs **inside** the browser (WebRTC
  `getDisplayMedia`); externally the OS only exposes top-level windows (HWNDs)
  to Windows.Graphics.Capture, and background tabs aren't even rendered — so
  per-tab capture is impossible for any desktop recorder (OBS/Zoom desktop have
  the same limit). Standard answer shipped in the dialog footer: drag the tab
  out into its own window, then pick that window.

## Verification

- `bun test` 46 pass · `bun run build` (strict tsc) ok · eslint: no new
  warnings (6 pre-existing) · `cargo fmt --check` clean ·
  `cargo clippy --all-targets -- -D warnings` clean · `cargo test` 40 pass ·
  `thumb_probe` visual check ok.
