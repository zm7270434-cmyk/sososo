//! App-behavior commands: window/tray preferences synced from the frontend
//! (Settings → Behavior).

use tauri::State;

use crate::error::AppResult;
use crate::state::AppState;

/// When enabled (the default), closing the window hides the app to the system
/// tray instead of quitting — a recording keeps running in the background.
#[tauri::command]
pub fn set_close_to_tray(state: State<'_, AppState>, enabled: bool) -> AppResult<()> {
    *state.close_to_tray.lock().unwrap() = enabled;
    Ok(())
}
