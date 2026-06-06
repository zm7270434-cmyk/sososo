# Add Gemini as a selectable AI provider (alongside OpenAI)

- **Date:** 2026-06-06
- **Scope:** AI summary + live translation can now run on **OpenAI _or_ Google Gemini**, user-selectable.

## Goal

User request: don't hardcode OpenAI for AI — add **Gemini** as an alternative. One global provider choice
drives both features (session summary + live per-segment translation).

## Research (context7 — Gemini API)

- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
- Auth: header **`x-goog-api-key: <KEY>`** (key never placed in URL/query).
- Body: `systemInstruction.parts[].text` + `contents[{role:"user",parts:[{text}]}]` + `generationConfig.temperature`.
- Response: `candidates[0].content.parts[0].text`; error `{ error: { message } }`.
- Default model **`gemini-2.5-flash`** (GA Flash tier — fast/cheap, analogous to `gpt-4o-mini`) — single constant.

## Decisions

- **Single global provider** (`ai_provider` ∈ `openai` | `gemini`), persisted as an `app_settings` row (same
  pattern as `summary_language`). No per-feature provider, no UI model selector (YAGNI).
- **Shared prompts + transcript rendering**; only the HTTP transport differs. Refactored `ai.rs` around a
  provider-agnostic `chat(provider, system, user, …)` dispatcher → `openai_chat` / `gemini_chat`. This also
  de-duplicated the HTTP/parse/error logic that was copy-pasted between `summarize` and `translate`.
- **Key per provider** in Windows Credential Manager: services `openai` / `gemini` (Deepgram STT unchanged).
- **Async without holding a lock** preserved: provider+key resolved synchronously (`resolve_ai_provider`)
  before the network `await`, so command futures stay `Send`.
- Error messages name the active provider; 401 (OpenAI) / 400·401·403 (Gemini) add a "check the … key" hint.

## Changes

**Backend (Rust):**

- `ai.rs` — `enum Provider { OpenAi, Gemini }` (`from_setting`/`key_service`/`label`); Gemini request/response/
  error structs; `chat()` dispatcher + `openai_chat`/`gemini_chat`; `summarize()`/`translate()` now take a
  `provider` arg and return via `chat`. `GEMINI_MODEL = "gemini-2.5-flash"`.
- `commands.rs` — `AI_PROVIDER_KEY`; `get_ai_provider`/`set_ai_provider` (validates openai|gemini);
  `resolve_ai_provider(db) -> (Provider, key)`; `summarize_session` & `translate_segment` route through it.
- `keys.rs` — doc: service is now deepgram | openai | gemini. `lib.rs` — register the 2 new commands.

**Frontend (TS/React):**

- `types/domain.ts` — `ApiService += 'gemini'`; new `AiProvider = 'openai' | 'gemini'`.
- `lib/ipc.ts` — `getAiProvider()` / `setAiProvider()`.
- `SettingsRoute.tsx` — Gemini API Key field (+ "Get a Gemini API key" link → AI Studio) and an **Active AI
  provider** dropdown (OpenAI / Gemini); `saveKey` generalized to `ApiService`.

## Verification

- `bun run build` — OK (80 modules, tsc strict). `cargo check` — OK.
- `cargo clippy` — clean for changed files (only the 2 pre-existing `mixer.rs` warnings remain).
- Runtime (real Gemini call) not tested headless — needs GUI + a Gemini key + a recorded session.

## Follow-ups

- Optional per-feature provider; model selector in Settings; surface which provider/model produced a summary.
