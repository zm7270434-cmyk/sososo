//! Secure API-key storage via the OS keychain (Windows Credential Manager).
//! Keys never reach the frontend — only `has_api_key` (a boolean) is exposed.

use keyring::Entry;

use crate::error::{AppError, AppResult};

const SERVICE: &str = "com.yusup.sososo";

fn entry(name: &str) -> AppResult<Entry> {
    Entry::new(SERVICE, name).map_err(|e| AppError::Config(format!("keyring open: {e}")))
}

/// `service` is "deepgram", "openai", or "gemini".
pub fn set_api_key(service: &str, value: &str) -> AppResult<()> {
    entry(service)?
        .set_password(value)
        .map_err(|e| AppError::Config(format!("keyring set: {e}")))
}

pub fn get_api_key(service: &str) -> AppResult<Option<String>> {
    match entry(service)?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(AppError::Config(format!("keyring get: {err}"))),
    }
}

pub fn has_api_key(service: &str) -> AppResult<bool> {
    Ok(get_api_key(service)?.is_some())
}
