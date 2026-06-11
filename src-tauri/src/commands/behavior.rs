//! App-behavior commands: window/tray preferences synced from the frontend
//! (Settings → Behavior).

use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::hotkey;
use crate::state::AppState;

/// When enabled (the default), closing the window hides the app to the system
/// tray instead of quitting — a recording keeps running in the background.
#[tauri::command]
pub fn set_close_to_tray(state: State<'_, AppState>, enabled: bool) -> AppResult<()> {
    *state.close_to_tray.lock().unwrap() = enabled;
    Ok(())
}

/// (Un)register the global start/stop-recording shortcut to match the
/// Settings → Behavior pref. Idempotent.
#[tauri::command]
pub fn set_global_shortcut_enabled(app: AppHandle, enabled: bool) -> AppResult<()> {
    hotkey::set_enabled(&app, enabled)
        .map_err(|e| AppError::Config(format!("global shortcut: {e}")))
}
