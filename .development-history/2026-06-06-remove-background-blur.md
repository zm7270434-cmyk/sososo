# Remove the Background blur setting (keep transparency)

**Decision:** Drop the **Background blur** feature entirely (user request). The
**Background transparency** slider stays. Supersedes
`2026-06-06-glass-transparency-blur-degloss.md` (blur half) and
`2026-06-06-native-acrylic-blur.md`.

**Why:** CSS `backdrop-filter` can't frost the desktop behind a transparent window;
the native Windows acrylic alternative works but has no adjustable radius (slider was
effectively on/off) and can lag window drags — not worth keeping.

## Removed

- **Frontend:** `backgroundBlur` + `setBackgroundBlur` + `BACKGROUND_BLUR_MIN/MAX`
  from `configStore` (and its `persist`); the Background blur slider from
  `SettingsRoute`; the `--glass-blur` var + `setWindowBlur` call from `MainApp`
  (the appearance effect now only sets `--glass-alpha`); `backdrop-filter` from the
  `liquid-glass` utility; `setWindowBlur` from `lib/ipc.ts`.
- **Backend:** `set_window_blur` command (`commands.rs`) + its `invoke_handler`
  registration (`lib.rs`); the `window-vibrancy` dependency (`Cargo.toml` / `Cargo.lock`).
- Docs (`CLAUDE.md`, this folder) updated.

## Kept

- **Background transparency** slider → `glassOpacity` → `--glass-alpha` on the
  `liquid-glass` fill. Works fully (the desktop shows through more/less).
- The glossy liquid-glass **edge** (border + inset highlight + inner glow).

## Verification

- `cargo check` ✓ (no `set_window_blur` / window-vibrancy).
- `bun run build` ✓ — 77 modules, no unused-import errors.
