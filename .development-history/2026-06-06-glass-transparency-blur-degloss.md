# Glass transparency & blur settings + de-gloss

**Goal:** Let the user tune how transparent and how blurry the app background is
(Settings → Appearance), and remove the distracting glossy effects from the glass.

## Settings (Appearance)

Two new sliders, alongside the existing UI/transcript font-size ones:

- **Background transparency** — 5–85% (higher = more see-through). Drives the glass
  fill alpha. Persisted as `glassOpacity` (alpha, default 0.58 = prior look).
- **Background blur** — 0–24px. Drives `backdrop-filter`. Persisted as `backgroundBlur`
  (default 0). **Honest caveat (shown in helper text):** over a transparent window CSS
  `backdrop-filter` cannot frost the desktop, so the blur mostly affects overlapping
  in-app layers — the control exists per the user's explicit choice ("CSS-only").

## How it's wired

- `configStore`: `glassOpacity`, `backgroundBlur` + setters + bounds
  (`GLASS_OPACITY_MIN/MAX`, `BACKGROUND_BLUR_MIN/MAX`); both persisted via `partialize`.
- `MainApp`: a `useEffect` writes `--glass-alpha` / `--glass-blur` onto
  `document.documentElement`. Hooks run before the in-session early return, so the
  recording widget reacts live too.
- `app.css` `@utility liquid-glass` now reads
  `background: rgb(28 28 34 / var(--glass-alpha,0.58))` and
  `backdrop-filter: blur(var(--glass-blur,0px))`.

## De-gloss (requested)

Removed the glossy treatment from `liquid-glass`:

- Dropped the `::before` / `::after` diagonal specular sheen, the bright `inset 0 1px 0
rgb(255 255 255 /.6)` top highlight + inner glow, and `isolation: isolate`.
- Bright white edge `rgb(255 255 255 /.35)` → faint `--color-glass-border` hairline.
- `--shadow-liquid` token (buttons/pills) de-glossed: bright white inset highlight
  removed → just a subtle `0 1px 3px rgb(0 0 0 /.18)` depth.

Result: flat, calm translucent panels; sheen no longer distracts.

## Verification

- `bun run build` (tsc strict + Vite) ✓ — 77 modules; CSS shrank slightly (sheen rules gone).
- Defaults reproduce the prior transparency; only the gloss is gone until the user moves the sliders.
- `CLAUDE.md` architecture note updated to match (flat glass + configurable alpha/blur).
