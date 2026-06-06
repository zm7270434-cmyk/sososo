# Native Windows acrylic blur (real background frosting)

**Goal:** Make the **Background blur** pref actually frost the desktop. CSS
`backdrop-filter` can't do this over a transparent window (it only blurs in-webview
content), so drive native Windows **acrylic** via `window-vibrancy`.

## Backend

- `Cargo.toml`: add `window-vibrancy = "0.5"` (resolved 0.5.3, Tauri-2 compatible).
- `commands.rs`: new `set_window_blur(window: WebviewWindow, enabled: bool, alpha: u8)`
  — `apply_acrylic(&window, Some((20,20,28, alpha)))` when enabled, else `clear_acrylic`.
  Windows-only (`#[cfg(target_os = "windows")]`); no-op elsewhere. Errors → `AppError::Config`.
- `lib.rs`: registered in `invoke_handler!`; setup comment updated.

## Frontend

- `ipc.ts`: `setWindowBlur(enabled, alpha)` wrapper.
- `MainApp`: the appearance effect now also calls
  `setWindowBlur(backgroundBlur > 0, round(glassOpacity * 255))` — acrylic turns on
  when Background blur > 0; tint opacity follows the transparency pref. Runs in both
  shell and recording modes (hooks fire before the in-session early return).

## Behavior

- **Background blur = 0** → acrylic cleared → sharp transparent desktop (prior look).
- **Background blur > 0** → acrylic on → desktop behind is genuinely frosted.
  Native acrylic has **no adjustable radius**, so the slider acts as on/off; the
  **transparency** slider controls the frost tint opacity.

## Caveats

- Acrylic can cause **drag lag** on Win10 1903+ / Win11 22000+ (documented
  window-vibrancy limitation), most noticeable on the small draggable recording widget.
  If it's annoying, switch `apply_acrylic` → `apply_blur` (lighter) — one-line change.
- The earlier "transparent glass, not blur / no vibrancy" stance is now opt-in: default
  stays off, blur is user-enabled.

## Verification

- `cargo check` ✓ (window-vibrancy 0.5.3 + `set_window_blur` compile).
- `bun run build` ✓ — 77 modules.
- Visual confirmation needs `bun run tauri dev` on Windows (acrylic is a runtime OS effect).
