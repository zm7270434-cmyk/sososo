use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, State};
use tokio_util::sync::CancellationToken;

use crate::audio::devices::{self, DeviceInfo};
use crate::db::{Db, SessionDetail, SessionSummary};
use crate::error::{AppError, AppResult};
use crate::state::{ActiveSession, AppState};
use crate::{ai, keys, session};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceLists {
    pub input: Vec<DeviceInfo>,
    pub output: Vec<DeviceInfo>,
}

/// List microphones and output devices for the Settings UI.
#[tauri::command]
pub fn list_devices() -> AppResult<DeviceLists> {
    // Enumerate on a dedicated thread so the COM apartment is clean — Tauri command
    // worker threads may already be initialized as STA, which conflicts with WASAPI's MTA.
    std::thread::spawn(|| -> AppResult<DeviceLists> {
        Ok(DeviceLists {
            input: devices::list_input_devices()?,
            output: devices::list_output_devices()?,
        })
    })
    .join()
    .map_err(|_| AppError::Audio("device enumeration thread panicked".into()))?
}

/// Persist the user's chosen capture devices (None = system default).
#[tauri::command]
pub fn set_devices(
    state: State<'_, AppState>,
    input_id: Option<String>,
    output_id: Option<String>,
) -> AppResult<()> {
    *state.input_device.lock().unwrap() = input_id;
    *state.output_device.lock().unwrap() = output_id;
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartResult {
    pub session_id: i64,
    pub started_at: String,
}

#[tauri::command]
pub fn start_session(
    app: AppHandle,
    state: State<'_, AppState>,
    db: State<'_, Db>,
    title: Option<String>,
) -> AppResult<StartResult> {
    if state.session.lock().unwrap().is_some() {
        return Err(AppError::Session("a session is already running".into()));
    }
    let key = keys::get_api_key("deepgram")?
        .ok_or_else(|| AppError::Config("Deepgram API key is not set (open Settings)".into()))?;

    let input = state.input_device.lock().unwrap().clone();
    let output = state.output_device.lock().unwrap().clone();
    let language = state.language.lock().unwrap().clone();
    let system_only = *state.system_only.lock().unwrap();

    // Create the persisted session row up front so its id can be returned
    // synchronously; a blank title falls back to a date/time label.
    let started_at = chrono::Utc::now().to_rfc3339();
    let title = title
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| {
            format!(
                "Recording {}",
                chrono::Local::now().format("%d-%m-%Y %H:%M")
            )
        });
    let id = db.create_session(&title, &language, system_only, &started_at)?;

    let cancel = CancellationToken::new();
    let paused = Arc::new(AtomicBool::new(false));
    session::spawn_session(
        app,
        id,
        key,
        input,
        output,
        language,
        system_only,
        cancel.clone(),
        paused.clone(),
    );
    *state.session.lock().unwrap() = Some(ActiveSession { id, cancel, paused });

    Ok(StartResult {
        session_id: id,
        started_at,
    })
}

/// Pause or resume the active session. While paused the audio bridge forwards no
/// audio to Deepgram (the WS stays open via keep-alive), so transcription halts
/// until resumed. No-op error if there is no active session.
#[tauri::command]
pub fn set_paused(state: State<'_, AppState>, paused: bool) -> AppResult<()> {
    match state.session.lock().unwrap().as_ref() {
        Some(s) => {
            s.paused.store(paused, Ordering::Relaxed);
            Ok(())
        }
        None => Err(AppError::Session("no active session".into())),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StopResult {
    pub session_id: i64,
    pub ended_at: String,
}

#[tauri::command]
pub fn stop_session(state: State<'_, AppState>) -> AppResult<StopResult> {
    let active = state.session.lock().unwrap().take();
    match active {
        Some(a) => {
            a.cancel.cancel();
            Ok(StopResult {
                session_id: a.id,
                ended_at: chrono::Utc::now().to_rfc3339(),
            })
        }
        None => Err(AppError::Session("no active session".into())),
    }
}

/// Set the transcription language ("multi"=auto, "en", "id", …) and whether to
/// capture system audio only (true) or system + mic (false).
#[tauri::command]
pub fn set_transcription_options(
    state: State<'_, AppState>,
    language: Option<String>,
    system_only: Option<bool>,
) -> AppResult<()> {
    if let Some(l) = language {
        *state.language.lock().unwrap() = l;
    }
    if let Some(s) = system_only {
        *state.system_only.lock().unwrap() = s;
    }
    Ok(())
}

/// `service` = "deepgram" | "openai" | "gemini". Stored in the OS keychain; never returned.
#[tauri::command]
pub fn set_api_key(service: String, value: String) -> AppResult<()> {
    keys::set_api_key(&service, &value)
}

#[tauri::command]
pub fn has_api_key(service: String) -> AppResult<bool> {
    keys::has_api_key(&service)
}

// --- Session history (Milestone D) ---

/// All recorded sessions (newest first) for the history sidebar.
#[tauri::command]
pub fn list_sessions(db: State<'_, Db>) -> AppResult<Vec<SessionSummary>> {
    db.list_sessions()
}

/// One session plus its full stored transcript, or `None` if it was deleted.
#[tauri::command]
pub fn get_session(db: State<'_, Db>, id: i64) -> AppResult<Option<SessionDetail>> {
    db.get_session(id)
}

/// Delete a recorded session and its transcript (cascades to segments).
#[tauri::command]
pub fn delete_session(db: State<'_, Db>, id: i64) -> AppResult<()> {
    db.delete_session(id)
}

/// Rename a recorded session.
#[tauri::command]
pub fn rename_session(db: State<'_, Db>, id: i64, title: String) -> AppResult<()> {
    db.rename_session(id, &title)
}

/// Rename a speaker label across a saved session's transcript (history view).
/// `from` is the current stored label (`null`/`None` = the un-diarized group);
/// `to` is the new name. An empty `to` is rejected. Returns rows changed.
#[tauri::command]
pub fn rename_speaker(
    db: State<'_, Db>,
    session_id: i64,
    from: Option<String>,
    to: String,
) -> AppResult<usize> {
    let to = to.trim();
    if to.is_empty() {
        return Err(AppError::Session("Speaker name cannot be empty".into()));
    }
    db.rename_speaker(session_id, from.as_deref(), to)
}

// --- AI summary (Milestone E) ---

/// `app_settings` key for the persisted AI-summary output-language preference.
const SUMMARY_LANGUAGE_KEY: &str = "summary_language";

/// `app_settings` key for the active AI provider ("openai" | "gemini").
const AI_PROVIDER_KEY: &str = "ai_provider";

/// Read the persisted AI provider ("openai" | "gemini"). Defaults to "openai"
/// when never set. Used by Settings to populate the provider dropdown.
#[tauri::command]
pub fn get_ai_provider(db: State<'_, Db>) -> AppResult<String> {
    Ok(db
        .get_setting(AI_PROVIDER_KEY)?
        .unwrap_or_else(|| "openai".to_string()))
}

/// Persist the active AI provider. Only "openai" or "gemini" are accepted.
#[tauri::command]
pub fn set_ai_provider(db: State<'_, Db>, provider: String) -> AppResult<()> {
    let normalized = match provider.trim().to_ascii_lowercase().as_str() {
        "gemini" => "gemini",
        "openai" => "openai",
        other => return Err(AppError::Config(format!("unknown AI provider: {other}"))),
    };
    db.set_setting(AI_PROVIDER_KEY, normalized)
}

/// Resolve the active AI provider and its API key (from the keychain). Reads the
/// persisted setting synchronously — the returned key is owned, so callers never
/// hold the DB lock across a network `await`.
fn resolve_ai_provider(db: &Db) -> AppResult<(ai::Provider, String)> {
    let setting = db
        .get_setting(AI_PROVIDER_KEY)?
        .unwrap_or_else(|| "openai".to_string());
    let provider = ai::Provider::from_setting(&setting);
    let key = keys::get_api_key(provider.key_service())?.ok_or_else(|| {
        AppError::Config(format!(
            "{} API key is not set (open Settings)",
            provider.label()
        ))
    })?;
    Ok((provider, key))
}

/// Read the persisted AI-summary output language (a Deepgram language code or the
/// literal `"auto"`). Defaults to `"auto"` when never set. Used by Settings to
/// populate the dropdown.
#[tauri::command]
pub fn get_summary_language(db: State<'_, Db>) -> AppResult<String> {
    Ok(db
        .get_setting(SUMMARY_LANGUAGE_KEY)?
        .unwrap_or_else(|| "auto".to_string()))
}

/// Persist the AI-summary output language (a language code or `"auto"`).
#[tauri::command]
pub fn set_summary_language(db: State<'_, Db>, language: String) -> AppResult<()> {
    db.set_setting(SUMMARY_LANGUAGE_KEY, &language)
}

/// Generate (and persist) an AI summary for a recorded session via the active AI
/// provider (OpenAI or Gemini), then return the Markdown summary. Requires that
/// provider's API key to be set in Settings.
///
/// `summary_language` is the desired output language: the literal `"auto"` (match
/// the transcript) or a human-readable language name (e.g. `"Indonesian"`). The
/// frontend resolves the persisted language code to this value.
///
/// The DB mutex is only held during the synchronous read/write steps — never
/// across the network `await` — so the command future stays `Send`.
#[tauri::command]
pub async fn summarize_session(
    db: State<'_, Db>,
    id: i64,
    summary_language: String,
) -> AppResult<String> {
    let detail = db
        .get_session(id)?
        .ok_or_else(|| AppError::Session("session not found".into()))?;
    if detail.segments.is_empty() {
        return Err(AppError::Session("no transcript to summarize yet".into()));
    }

    let (provider, key) = resolve_ai_provider(&db)?;

    let (summary, model) = ai::summarize(
        provider,
        &key,
        &detail.session.title,
        &detail.session.language,
        &summary_language,
        &detail.segments,
    )
    .await?;

    let at = chrono::Utc::now().to_rfc3339();
    db.save_summary(id, &summary, &model, &at)?;
    Ok(summary)
}

// --- Live translation (active AI provider) ---

/// Translate one finalized transcript line via the active AI provider (OpenAI or
/// Gemini) into `target_lang` (a human-readable language name like "English") and
/// persist it on the segment row, returning the translated text.
///
/// Idempotent: if the row already has a translation for the same language it is
/// returned without calling the provider, so a line is never translated twice. The
/// frontend additionally caches per segment, so this is the defensive backstop.
/// Requires the active provider's key (Settings). Like `summarize_session`, the DB
/// mutex is only held for the synchronous steps — never across the network `await`.
#[tauri::command]
pub async fn translate_segment(
    db: State<'_, Db>,
    session_id: i64,
    segment_id: String,
    text: String,
    target_lang: String,
) -> AppResult<String> {
    if let Some((existing, lang)) = db.get_translation(session_id, &segment_id)? {
        if lang == target_lang {
            return Ok(existing);
        }
    }

    let (provider, key) = resolve_ai_provider(&db)?;

    let translated = ai::translate(provider, &key, &text, &target_lang).await?;
    db.save_translation(session_id, &segment_id, &translated, &target_lang)?;
    Ok(translated)
}
