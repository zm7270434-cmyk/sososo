//! App-behavior commands: window/tray preferences synced from the frontend
//! (Settings → Behavior).

use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::hotkey;
use crate::meeting;
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

/// The combo label the recording toggle is actually bound to right now
/// ("Ctrl+Alt+R", the +Shift fallback, …), or `None` while disabled — or when
/// every candidate is taken by another app. Settings shows this live.
#[tauri::command]
pub fn get_active_shortcut(app: AppHandle) -> Option<String> {
    hotkey::active_label(&app).map(str::to_string)
}

/// Poll for an active-looking meeting (Zoom/Teams/Webex window or a Meet/web
/// meeting browser tab). Cheap — no thumbnails. Enumerates on a dedicated
/// thread (mirrors `list_windows`); `None` on non-Windows platforms.
#[tauri::command]
pub fn detect_meeting() -> Option<meeting::DetectedMeeting> {
    std::thread::spawn(meeting::detect).join().unwrap_or(None)
}

/// Show an OS notification (used when a meeting is detected while the app is
/// unfocused/hidden in the tray).
#[tauri::command]
pub fn notify(app: AppHandle, title: String, body: String) -> AppResult<()> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| AppError::Config(format!("notification: {e}")))
}
