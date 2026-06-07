//! Live-session lifecycle commands: start, pause/resume, stop, options.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, State};
use tokio_util::sync::CancellationToken;

use crate::error::{AppError, AppResult};
use crate::state::{ActiveSession, AppState};
use crate::{db::Db, keys, session};

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
