use serde::Serialize;

use crate::error::AppResult;

// Per-OS device enumeration backend.
#[cfg(target_os = "windows")]
#[path = "windows.rs"]
mod platform;
#[cfg(target_os = "macos")]
#[path = "macos.rs"]
mod platform;
#[cfg(target_os = "linux")]
#[path = "linux.rs"]
mod platform;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

/// Microphones / line-in (capture endpoints).
pub fn list_input_devices() -> AppResult<Vec<DeviceInfo>> {
    platform::list_input_devices()
}

/// System-audio sources. Windows: speakers / output endpoints we loopback-capture.
/// macOS: input devices usable as a system-audio source (e.g. BlackHole), since
/// macOS has no per-output loopback — the user routes output into a virtual input.
/// Linux: each output sink's monitor source (PulseAudio/PipeWire), no setup needed.
pub fn list_output_devices() -> AppResult<Vec<DeviceInfo>> {
    platform::list_output_devices()
}
