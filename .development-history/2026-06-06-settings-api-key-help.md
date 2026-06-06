# Settings: Deepgram key help + $200 free-credit nudge

**Goal:** Help users who do not yet have an API key — show where to get one and
that Deepgram is free to start.

## Changes

- `SettingsRoute.tsx`: under the Deepgram key field, a callout — gift icon +
  "New Deepgram accounts get **$200 in free credit** (~45,000 min), no credit
  card" + a **Get a free Deepgram API key** link that opens
  `https://console.deepgram.com/signup` in the system browser, plus a
  "sign up → create key → paste above" hint. Added a smaller **Get an OpenAI API
  key** link (→ `platform.openai.com/api-keys`) under the OpenAI field.
- Reused the About page's `openExternal` pattern (`plugin-opener` `openUrl` with
  a `window.open` fallback for plain `vite dev`).
- `lib/icons.ts`: added `IconExternal` (ExternalLinkIcon) + `IconGift` (GiftIcon).

## Notes

- The $200 / no-card / ~45,000-min figure is verified on deepgram.com/pricing as
  of 2026-06. If Deepgram changes the offer, update the copy in `SettingsRoute`.

## Verification

- `bun run build` ✓ (tsc strict + vite, 80 modules).
