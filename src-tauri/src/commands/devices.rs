//! Audio-device enumeration + selection commands.

use serde::Serialize;
use tauri::State;

use crate::audio::devices::{self, DeviceInfo};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

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
