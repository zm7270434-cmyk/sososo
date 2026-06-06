# Header brand: wordmark logo instead of text

**Goal:** Replace the "sososo" text + wave-icon brand in the titlebar with the
actual brand wordmark image.

## Changes

- `Titlebar.tsx`: dropped the `IconWave` accent + `sososo` text node; render
  `<img src="/sososo_brand_logo_white-bg-transparent.png" alt="sososo" />` instead
  (`h-[18px] w-auto object-contain select-none`, `draggable={false}` so it doesn't
  ghost-drag — window drag still works via the header's `data-tauri-drag-region`).
  Removed the now-unused `IconWave` import (TS strict `noUnusedLocals`).
- `public/sososo_brand_logo_white-bg-transparent.png`: the white wordmark on a
  transparent bg (served at `/` by Vite). White art reads on the dark glass.

## Verification

- `bun run build` ✓ — 77 modules, no unused-import error.
