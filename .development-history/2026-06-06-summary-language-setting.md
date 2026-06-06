# AI Summary Output Language (persisted in DB)

Goal: let the user choose the language the AI summary is generated in, and persist that choice in the
SQLite database (not localStorage). Decision via brainstorming: a **global default** in Settings,
full language list **+ an "Auto" option**, default **Auto** (match the transcript language).

## Decisions

- Scope: single global default (Settings → Language), not per-session.
- Languages: reuse `TRANSLATE_TARGETS` (no `multi`) + `{ code: 'auto' }`; default `auto`.
- Persistence: new key-value `app_settings` table in SQLite — first app-wide setting kept in the DB
  (devices/language/appearance still live in memory or localStorage).
- Frontend→backend convention mirrors `translate_segment`: the frontend resolves the stored code to a
  human-readable language name (or the literal `"auto"`) and passes it to `summarize_session`.

## Key changes

Backend (Rust):

- `db.rs` — new `app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)` table in `SCHEMA`
  (`CREATE TABLE IF NOT EXISTS`, so it self-applies to old DBs too — no `migrate()` entry needed);
  new `get_setting(key)` / `set_setting(key, value)` (upsert).
- `ai.rs` — `summarize(...)` gains a `summary_language` arg. SYSTEM_PROMPT is no longer hardcoded to
  English; the user prompt carries a language directive: `"auto"` → write in the transcript's
  language, otherwise → write the whole summary (incl. headings) in that language. Markdown structure
  (Summary / Key Points / Action Items) unchanged; the FE renderer is generic over heading text.
- `commands.rs` — `get_summary_language()` (defaults `"auto"`) and `set_summary_language(language)`
  read/write the `summary_language` key; `summarize_session(id, summary_language)` threads it into
  `ai::summarize`. DB mutex still never held across the network await.
- `lib.rs` — registered `get_summary_language` + `set_summary_language`.

Frontend (TS):

- `lib/languages.ts` — `SUMMARY_LANGUAGES = [{ auto }, ...TRANSLATE_TARGETS]`.
- `lib/ipc.ts` — `getSummaryLanguage` / `setSummaryLanguage` wrappers; `summarizeSession(id, lang)`
  now takes the resolved output language.
- `SettingsRoute.tsx` — "AI summary language" dropdown in the Language section; loads via
  `getSummaryLanguage` on mount, persists via `setSummaryLanguage` on change. Not stored in
  configStore/localStorage — DB only.
- `SessionDetailRoute.tsx` — `doSummarize` reads the persisted code, passes `"auto"` verbatim or
  `languageLabel(code)` for a specific language.

## Verification

- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets` — OK (only pre-existing
  `mixer.rs` warnings, out of scope).
- `bun run build` — OK (tsc strict + vite, 77 modules).
- Manual: not run here (needs an OpenAI key + a recorded transcript).
