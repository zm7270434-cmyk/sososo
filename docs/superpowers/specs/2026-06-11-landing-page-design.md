# Landing page — design

**Date:** 2026-06-11 · **Status:** approved (autonomous session) · **Scope:** `website/` subproject + Pages deploy

## Decision: same repo, `website/` folder

Separate repo was considered and rejected: solo maintainer, download links/version/changelog all live
here, and GitHub Pages + path-filtered workflows make a monorepo website cheap. `git subtree split`
can extract it later if it ever grows into a full docs site.

## Goal

A single-page marketing site for sososo at `https://yusupsupriyadi.github.io/sososo/` that converts
visitors to a download, communicates the BYOK/privacy model honestly, and points to GitHub for
source/contributing. Copy in English (project rule).

## Aesthetic direction — "the app, as a website"

The page reuses the app's exact visual language so the marketing matches the product:

- Dark atmosphere standing in for "the desktop behind the glass": deep `#0a0a0f` field, soft blue
  (`#6ea8fe`) / purple (`#b794f6`) radial glows, faint film-grain noise, and giant concentric rings
  (the logo's "O" / sound-wave motif, via `repeating-radial-gradient`).
- Panels are the app's **liquid-glass** material: `rgb(28 28 34 / 0.58)` fill, white 0.35 border,
  inset top highlight (`@utility liquid-glass` copied from `src/styles/app.css`), same radii/tokens.
- Type: **Archivo** (expanded black — matches the geometric wordmark) for display, **Schibsted
  Grotesk** for body, **Spline Sans Mono** for eyebrows/captions/labels. Google Fonts, `display=swap`.
- Signature element: a **live mock of the recording widget** in the hero — the always-on-top pill
  (pulsing rec dot, timer, yellow pause / red finish) above a transcript panel where scripted caption
  lines stream in word-by-word as _interim_ (dim italic) then finalize (bright), ending in a mini AI
  summary card, then looping. Pause button actually pauses the demo. Honors `prefers-reduced-motion`
  (static final state).

## Page structure (single `index.html`)

1. **Nav** (sticky glass): wordmark · Features / How it works / Privacy / Download · GitHub + Download CTA.
2. **Hero** (asymmetric 2-col): eyebrow, H1 "Live captions for everything you hear — and say.",
   subcopy (open source, Deepgram STT, AI summary, no account/server/telemetry), primary CTA
   "Download for {detected OS}" + "Star on GitHub", microcopy "Free · AGPL-3.0 · {version}". Right:
   the recording-widget demo over concentric rings.
3. **Badge strip**: Tauri 2 · Deepgram · OpenAI/Gemini · AGPL-3.0 (glass chips).
4. **Features** (bento: 2 large + 4 small, from README): dual capture (channel diagram), live
   captions (interim→final visual), languages, compact widget, AI summaries & translation, privacy.
5. **How it works** (3 steps): Install → Bring your keys (OS keychain) → Hit record (Ctrl+Alt+R,
   meeting auto-detect note).
6. **Demo**: lite YouTube embed (thumbnail + play → swaps in `youtube-nocookie` iframe on click).
7. **Privacy**: "what leaves your machine" copy + data-flow card (You → Deepgram / optional AI),
   link to PRIVACY.md.
8. **Download** (`#download`): 3 OS cards (exact `releases/latest/download/...` asset links from the
   README; detected OS highlighted), latest version via GitHub API, code-signing warning, BlackHole
   note for macOS, "all releases" link.
9. **Open source**: AGPL-3.0 + commercial dual license, trademark/rebrand note, star count, links to
   repo/CONTRIBUTING/LICENSING.
10. **Footer**: Project / Legal / Powered-by link columns, © Yusup Supriyadi.

## Tech

- `website/` is a self-contained Bun + Vite 7 + TypeScript (strict) + Tailwind CSS v4 subproject —
  **no framework**: the page is static; one small `main.ts` wires dynamics. `base: '/sososo/'`.
- Testable logic isolated in `website/src/lib/release.ts` (pure, TDD via `bun test`): OS detection
  from platform/UA, download-asset map (single source for all links), `primaryDownload`,
  `formatVersion`, GitHub API URLs. DOM wiring stays thin in `main.ts`.
- Runtime fetches (graceful fallback if rate-limited/offline): `releases/latest` → version badges;
  repo → star count.
- Root tooling integration: root `bun test` also runs website tests (pure TS, no install needed);
  ESLint ignores `website/dist`; Prettier formats `website/` with the root config; root `tsc` is
  untouched (`include: ["src"]`).

## Deploy

- `.github/workflows/website.yml`: on push to master with `paths: website/**` (+ self) and
  `workflow_dispatch` → bun install/test/build in `website/` → `actions/upload-pages-artifact` →
  `actions/deploy-pages` (Pages source = GitHub Actions).
- `ci.yml` gets `paths-ignore: website/**` so landing-page edits skip the 3-OS Rust matrix; the
  website workflow runs the website tests instead.

## Error handling

- API fetch failures: version/star placeholders keep neutral defaults ("Latest release", "Star on
  GitHub") — never broken UI.
- Unknown OS (mobile etc.): hero CTA falls back to anchor `#download` with generic label.

## Out of scope

Custom domain, analytics, docs site, i18n, screenshots pipeline.

## Addendum (2026-06-11): video recording + transcript chat

Two showcase sections added after Features (user request), both as faithful CSS recreations of the
in-app UI rather than screenshots: `#video` (window-picker grid + REC status row; MP4 with mixed
mic + system audio, Windows & macOS) and `#chat` (the per-session "Ask about this transcript"
panel: blue user bubbles, glass assistant bubble, purple Send). Features bento grows to 6 small
cards (3-col) linking to the sections; hero/how-it-works/meta copy mention both features. Static
markup only — no new JS or tests.
