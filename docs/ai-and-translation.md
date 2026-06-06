# AI summary & live translation

Two optional features, both powered by the **active AI provider** (OpenAI or
Google Gemini). Implemented in [`ai.rs`](../src-tauri/src/ai.rs) and exposed via
the `summarize_session` / `translate_segment` commands in
[`commands.rs`](../src-tauri/src/commands.rs).

Both features share the same provider selection, the same transcript rendering,
and the same provider-agnostic `chat()` core — only the HTTP transport differs.

## Providers

|                  | OpenAI                        | Gemini                             |
| ---------------- | ----------------------------- | ---------------------------------- |
| Setting value    | `"openai"` (default)          | `"gemini"`                         |
| Model            | `gpt-4o-mini`                 | `gemini-2.5-flash`                 |
| Endpoint         | `/v1/chat/completions`        | `…/models/{model}:generateContent` |
| Auth             | `Authorization: Bearer <key>` | `x-goog-api-key: <key>` header     |
| Keychain service | `openai`                      | `gemini`                           |

The active provider is persisted as the `ai_provider` setting in SQLite
(`app_settings`). `resolve_ai_provider(db)` reads it, maps it via
`Provider::from_setting` (unknown → OpenAI), then loads that provider's key from
the **OS keychain**. The key is owned (cloned out) so the DB mutex is never held
across the network `await`. A missing key yields a `config error` telling the
user to open Settings.

> The HTTP client is `reqwest` with `rustls` (already in the dependency tree via
> the Deepgram crate), so no native TLS/OpenSSL is pulled in.

## Transcript rendering

`render_transcript(segments)` turns stored segments into a speaker-labelled
plain-text block:

```
You: <text>
Other (speaker 1): <text>
Other: <text>
```

`"you"` → `You`; everything else → `Other` (with the diarized speaker number when
present). The block is capped at `MAX_TRANSCRIPT_CHARS = 60_000` (~15k tokens);
longer transcripts are truncated on a char boundary with a visible
`[…transcript truncated…]` marker.

## Summaries — `summarize`

Triggered from the session detail view via `summarizeSession(id, summaryLanguage)`.

- **Output language:** `summaryLanguage` is the literal `"auto"` (match the
  transcript) or a human-readable name like `"Indonesian"`. The frontend resolves
  the persisted `summary_language` **code** to this display name before calling.
- **Prompt:** a fixed system prompt (summarize faithfully, use only the
  transcript, `"You"` = the app user / mic, `"Other"` = system audio) plus a user
  prompt requesting a fixed Markdown shape:

  ```markdown
  ## Summary

  (2–4 sentences)

  ## Key Points

  - …

  ## Action Items

  - … (or "None")
  ```

  The section headings are translated into the output language too.

- **Tuning:** `temperature = 0.3`, timeout `90 s`.
- **Result:** the Markdown summary is persisted (`save_summary` → `summary`,
  `summary_model`, `summarized_at`) and returned. Errors if the transcript is
  empty.

## Live translation — `translate`

Driven by [`useLiveTranslation`](../src/hooks/useLiveTranslation.ts) while
recording (and available in history), one finalized line at a time via
`translateSegment(sessionId, segmentId, text, targetLang)`.

- **Prompt:** a system prompt instructing a faithful, output-only translation
  into `targetLang` (no quotes/notes/preamble; return unchanged if already in the
  target language). `temperature = 0.2`, timeout `30 s` (it runs many times per
  session, so it is kept lightweight).
- **Idempotency (never translate a line twice):**
  1. **Backend** — `translate_segment` first checks `get_translation`; if a
     translation already exists for the same `targetLang`, it returns it without
     calling the provider, then `save_translation` persists new results.
  2. **Frontend** — `useLiveTranslation` marks each segment `pending`
     _synchronously_, skips lines already done/in-flight for the same text +
     language, and ignores stale responses if the text/language changed.

  This two-layer guard means a given line is translated at most once per target
  language. Translations are stored on the segment row (`translation`,
  `translation_lang`).

## Error handling

Both transports surface provider errors as `AppError::Ai` with the provider's
own error message and a contextual hint:

- OpenAI `401` → "check the OpenAI API key in Settings".
- Gemini `400/401/403` → "check the Gemini API key in Settings".

Non-2xx responses parse the provider's `{ "error": { "message": … } }` envelope
(falling back to the raw body). Empty/blocked candidates yield "returned no
content".

## Privacy

These are the **only** features that send your **transcript** off the machine,
and only when you trigger them:

- **Summary** → the rendered transcript goes to the chosen provider once, on
  demand.
- **Live translation** → each finalized line goes to the provider when enabled.

Audio itself only ever goes to **Deepgram** (during recording). API keys never
leave the machine except as auth headers. See [`PRIVACY.md`](../PRIVACY.md) and
[Security & configuration](./security-and-config.md).

## Changing models

Models are single constants in [`ai.rs`](../src-tauri/src/ai.rs)
(`OPENAI_MODEL`, `GEMINI_MODEL`) — change them in one place. To add a provider,
add a `Provider` variant, its `key_service()`/`label()`, a transport function,
and a `chat()` match arm.

## Related

- [IPC reference](./ipc-reference.md#ai-summary-translation--settings)
- [Data model → `app_settings`](./data-model.md#app_settings)
- [Security & configuration](./security-and-config.md)
