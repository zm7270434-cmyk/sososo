# IPC reference

The contract between the React frontend and the Rust backend: **commands**
(frontend → backend, request/response) and **events** (backend → frontend,
push).

- Commands are registered in [`lib.rs`](../src-tauri/src/lib.rs) `invoke_handler!`,
  implemented in [`commands.rs`](../src-tauri/src/commands.rs), and wrapped with
  typed helpers in [`lib/ipc.ts`](../src/lib/ipc.ts).
- Events are defined in [`events.rs`](../src-tauri/src/events.rs) and subscribed
  via [`lib/events.ts`](../src/lib/events.ts) + the
  [`useTranscriptStream`](../src/hooks/useTranscriptStream.ts) hook.

## Conventions

- **Casing:** Tauri auto-maps **camelCase (JS) ↔ snake_case (Rust)**. The TS
  wrappers pass camelCase; Rust params are snake_case.
- **Errors:** every command returns `AppResult<T>` = `Result<T, AppError>`.
  `AppError` serializes to a **plain string**, so a failed `invoke()` rejects
  with that string. See [Error model](#error-model).
- **Async:** `summarize_session` and `translate_segment` are `async` (they make
  network calls); the rest are synchronous.
- **Secrets:** API keys are write-only from the UI — only `has_api_key` (a
  boolean) is ever read back. See [Security & config](./security-and-config.md).

## Commands

### Devices & transcription options

| Command (TS wrapper)                            | Rust                        | Params → Returns                    | Notes                                                                                                                             |
| ----------------------------------------------- | --------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `listDevices()`                                 | `list_devices`              | → `DeviceLists`                     | `{ input, output }` device lists. Enumerated on a fresh thread (clean COM apartment on Windows).                                  |
| `setDevices(inputId, outputId)`                 | `set_devices`               | `inputId?`, `outputId?` → `void`    | `null` = system default. Stored in `AppState` (in-memory).                                                                        |
| `setTranscriptionOptions(language, systemOnly)` | `set_transcription_options` | `language?`, `systemOnly?` → `void` | `language` = Deepgram code (`"multi"`/`"en"`/`"id"`/…); `systemOnly` toggles mic capture. Either may be `null` (leave unchanged). |

### Session control

| Command                | Rust            | Params → Returns         | Notes                                                                                                                                                                  |
| ---------------------- | --------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startSession(title?)` | `start_session` | `title?` → `StartResult` | Requires a Deepgram key. Creates the DB row, returns `{ sessionId, startedAt }`. Blank title → `"Recording dd-mm-YYYY HH:MM"`. Errors if a session is already running. |
| `stopSession()`        | `stop_session`  | → `StopResult`           | Cancels the active session; returns `{ sessionId, endedAt }`. Errors if none active.                                                                                   |
| `setPaused(paused)`    | `set_paused`    | `paused: bool` → `void`  | Pause/resume; backend stops/forwards audio to Deepgram (WS stays open via keep-alive). Errors if none active.                                                          |

### API keys

| Command                     | Rust          | Params → Returns                        | Notes                                                                        |
| --------------------------- | ------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| `setApiKey(service, value)` | `set_api_key` | `service: ApiService`, `value` → `void` | `service` ∈ `"deepgram" \| "openai" \| "gemini"`. Stored in the OS keychain. |
| `hasApiKey(service)`        | `has_api_key` | `service: ApiService` → `bool`          | The **only** way the UI learns about keys; the value is never returned.      |

### Session history (persistence)

| Command                              | Rust             | Params → Returns                      | Notes                                                                                                                                               |
| ------------------------------------ | ---------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listSessions()`                     | `list_sessions`  | → `SessionSummary[]`                  | Newest first, each with a `segmentCount`.                                                                                                           |
| `getSession(id)`                     | `get_session`    | `id` → `SessionDetail \| null`        | Session + full transcript (chronological). `null` if deleted.                                                                                       |
| `deleteSession(id)`                  | `delete_session` | `id` → `void`                         | Cascades to its segments.                                                                                                                           |
| `renameSession(id, title)`           | `rename_session` | `id`, `title` → `void`                |                                                                                                                                                     |
| `renameSpeaker(sessionId, from, to)` | `rename_speaker` | `sessionId`, `from?`, `to` → `number` | Renames a speaker label across one session's transcript. `from = null` matches the un-diarized group; empty `to` is rejected. Returns rows changed. |

### AI summary, translation & settings

| Command                                                    | Rust                   | Params → Returns                              | Notes                                                                                                                                                                                |
| ---------------------------------------------------------- | ---------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getAiProvider()`                                          | `get_ai_provider`      | → `AiProvider`                                | `"openai" \| "gemini"`. Defaults to `"openai"`.                                                                                                                                      |
| `setAiProvider(provider)`                                  | `set_ai_provider`      | `provider` → `void`                           | Governs **both** summaries and live translation. Only `openai`/`gemini` accepted.                                                                                                    |
| `getSummaryLanguage()`                                     | `get_summary_language` | → `string`                                    | A language code or `"auto"`. Defaults to `"auto"`.                                                                                                                                   |
| `setSummaryLanguage(language)`                             | `set_summary_language` | `language` → `void`                           | Persisted in `app_settings`.                                                                                                                                                         |
| `summarizeSession(id, summaryLanguage)`                    | `summarize_session`    | `id`, `summaryLanguage` → `string` (Markdown) | **async.** `summaryLanguage` = `"auto"` or a display name like `"Indonesian"`. Persists the summary; errors if the transcript is empty or the provider key is missing.               |
| `translateSegment(sessionId, segmentId, text, targetLang)` | `translate_segment`    | … → `string`                                  | **async.** Translates one finalized line into `targetLang` (display name). Idempotent — re-requesting the same language returns the stored translation without calling the provider. |

See [AI & translation](./ai-and-translation.md) for prompts, models, and timeouts.

## Events

Both events are emitted **globally** by the backend; the app subscribes globally
(mount `useTranscriptStream` **once** per window) and pipes payloads into the
Zustand stores. Payload keys are camelCase.

### `session://state`

```ts
interface SessionStateEvent {
  sessionId: number | null;
  state: 'idle' | 'starting' | 'recording' | 'stopping' | 'stopped' | 'reconnecting' | 'error';
  startedAt?: string | null; // RFC-3339, set when entering "recording"
  error?: string | null; // set when state === "error"
}
```

State transitions emitted by `run_session`: `starting` → `recording` → (on stop)
`stopped`; `error` on any failure. The frontend resets the transcript on
`starting` and resets pause accounting on `recording`/`stopped`/`idle`.

### `transcript://segment`

```ts
interface TranscriptSegmentEvent {
  sessionId: number;
  segmentId: string; // "{session}:{channel}:{start}" — stable across interim updates
  source: 'you' | 'remote';
  speaker?: string | null; // "You" or "Speaker N"
  text: string;
  tStart: number; // seconds
  tEnd?: number | null; // seconds
  isFinal: boolean; // interim vs finalized
  confidence?: number | null;
}
```

The frontend **upserts by `segmentId`**, so interim lines are replaced in place
when finalized. Only `isFinal` lines are persisted by the backend.

## Error model

[`AppError`](../src-tauri/src/error.rs) serializes to its `Display` string:

| Variant   | String prefix       | Raised by                                                            |
| --------- | ------------------- | -------------------------------------------------------------------- |
| `Audio`   | `audio error: …`    | Capture / device enumeration.                                        |
| `Session` | `session error: …`  | Session lifecycle (already running, none active, empty transcript…). |
| `Config`  | `config error: …`   | Missing key, keychain access, unknown provider.                      |
| `Db`      | `database error: …` | Any `rusqlite` failure (`From<rusqlite::Error>`).                    |
| `Ai`      | `AI error: …`       | OpenAI/Gemini transport/parse (`From<reqwest::Error>`).              |

In the UI these surface as the rejected-promise string (e.g. shown in
`RecordingView`'s error banner or a settings status line).

## Related

- [Data model](./data-model.md) — the `SessionSummary` / `StoredSegment` /
  `SessionDetail` shapes returned by the history commands.
- [Frontend](./frontend.md) — how the wrappers and stores consume these.
