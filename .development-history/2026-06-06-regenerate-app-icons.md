# Regenerate app icons from updated brand source

**Goal:** Re-bake all Tauri icon assets after the brand bullseye source
(`public/sososo_icon.png`) was updated.

## Changes

- Ran `bun run tauri icon public/sososo_icon.png` (1024×1024 RGBA source) →
  regenerated every `src-tauri/icons/*` asset: desktop PNGs (32/64/128/128@2x),
  `icon.ico`, `icon.icns`, `icon.png`, plus the Windows Store `Square*Logo` /
  `StoreLogo` set.
- Deleted the `android/` & `ios/` dirs the tool also emits — project is
  Windows-only, so they are not committed.
- Favicon needs no change: `index.html` already points at `/sososo_icon.png`
  (served from `public/` by Vite), so it tracks the source automatically.

## Verification

- `tauri icon` completed with no errors; visually confirmed `128x128.png`
  renders the new bullseye.
