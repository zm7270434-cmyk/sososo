# Audio source: icon toggle on the Start screen

**Goal:** Replace the "Audio source" `<select>` on the Start-transcription page with icon
buttons for a clearer, one-tap choice (better UX than a dropdown for a binary pick).

## Key changes

- `src/windows/main/routes/LibraryRoute.tsx`
  - Audio source dropdown → a 2-button **segmented toggle** (`grid grid-cols-2`,
    `role="group"`). Each button shows an icon + label + sub-label and highlights with the
    accent style when active (matches the Start button's accent tokens).
    - **Meeting** (`systemOnly=false`): `IconRemote`, "System + Mic".
    - **System only** (`systemOnly=true`): `IconSpeaker`, "Video / music".
  - Driven by a module-scope `AUDIO_SOURCES` list; click calls `setSystemOnly(...)`.
  - `aria-pressed` per button + `title` hint for accessibility.
  - Removed the now-unused `onSource` change handler; added `IconRemote` import.

## Decisions

- Only the **Audio source** mode (binary) became buttons. Microphone / System-audio device
  pickers stay `<select>` because their option lists are dynamic.
- No behavior/logic change — `systemOnly` mapping is identical, so this is presentational.

## Verification

- `bun run build` (tsc strict + vite): pass, 94 modules.
- `bun test`: 33 pass / 0 fail.
- Manual: form only renders inside the Tauri window (needs a Deepgram key), so confirm
  visually with `bun run tauri dev`.

## Follow-up: language accuracy tip

- Added a small tip (info icon + `text-[11px] text-fg-faint`) directly **below the Language
  select**: "Tip: picking a specific language (e.g. English) is more accurate than Auto."
- Removed the duplicate sentence from the bottom helper paragraph (now only describes the
  Pause/Finish behavior) so the same advice isn't shown twice.
- Re-verified: `bun run build` pass, `bun test` 33 pass / 0 fail.
