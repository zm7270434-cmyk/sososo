//! API-key commands. Keys live in the OS keychain and are never returned to the
//! frontend — only a boolean presence check is exposed.

use crate::error::AppResult;
use crate::keys;

/// `service` = "deepgram" | "openai" | "gemini". Stored in the OS keychain; never returned.
#[tauri::command]
pub fn set_api_key(service: String, value: String) -> AppResult<()> {
    keys::set_api_key(&service, &value)
}

#[tauri::command]
pub fn has_api_key(service: String) -> AppResult<bool> {
    keys::has_api_key(&service)
}
