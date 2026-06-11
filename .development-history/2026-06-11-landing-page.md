# Landing page (website/) + GitHub Pages deploy

**Date:** 2026-06-11 · **Scope:** new `website/` subproject, deploy workflow, CI path filters

## Goal

Public landing page for the project at <https://yusupsupriyadi.github.io/sososo/>. Kept in this
repo (vs. a separate one): solo maintainer, release links/version/changelog live here, and Pages +
path-filtered workflows make a monorepo site cheap. Design spec:
`docs/superpowers/specs/2026-06-11-landing-page-design.md`.

## Key changes

- `website/` — self-contained Bun + Vite 7 + TS (strict) + Tailwind v4 subproject, **no framework**.
  Single `index.html`; `src/main.ts` wires dynamics; `base: '/sososo/'`.
- Visual language mirrors the app: liquid-glass tokens copied from `src/styles/app.css`, dark
  atmosphere, concentric-ring (logo "O") motif. Fonts: Archivo / Schibsted Grotesk / Spline Sans Mono.
- Hero contains a **live recreation of the recording widget**: scripted captions stream word-by-word
  as interim → final, end in an AI-summary card, loop; pill pause/stop buttons actually control it.
  `prefers-reduced-motion` → static final state (`?motion` query param forces the full experience).
- `website/src/lib/release.ts` (TDD, 14 tests): OS detection, download-asset map (single source of
  truth for `releases/latest/download/...` links), `primaryDownload`, `formatVersion`, API URLs.
- Runtime GitHub API fetches (version + stars) with graceful fallbacks; detected-OS download card
  gets a "Detected" badge; lite YouTube embed (thumbnail → `youtube-nocookie` iframe on click).
- `og.png` social card generated from the brand wordmark (System.Drawing, 1200×630).
- `.github/workflows/website.yml`: push to master with `paths: website/**` → bun install/test/build
  → `upload-pages-artifact` → `deploy-pages`. `ci.yml` gets matching `paths-ignore` so website-only
  pushes skip the 3-OS Rust matrix.
- Root integration: ESLint ignores `website/dist`; root `bun test` also runs the website tests;
  README links the website.

## Decisions

- `overflow-x: clip` on `html` (+ `overflow-x-hidden` body fallback for Safari < 16) so decorative
  rings never cause horizontal panning.
- No analytics, no custom domain, no docs site (out of scope for now).

## Verification

- `bun test` root: 76 pass (incl. 14 website). `bun run build` (root app) + `website` build green.
- ESLint 0 errors (fixed pre-existing `no-useless-assignment` in `useMeetingDetection.ts` that had
  CI red since 0e0a069 — separate commit).
- Manual browser pass (vite preview): OS-detect CTA, live version `v0.8.0` + stars from the API,
  caption loop (stream → finalize → trim → summary → repeat), pause freezes / stop restarts,
  YouTube iframe swap, no horizontal scroll, reduced-motion static state.
