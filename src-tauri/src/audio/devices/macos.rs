//! macOS device enumeration (CoreAudio via cpal). cpal exposes no stable endpoint
//! id, so we use the device name as the id (capture resolves devices by name).

use cpal::traits::{DeviceTrait, HostTrait};

use super::DeviceInfo;
use crate::error::{AppError, AppResult};

// cpal 0.17 deprecates `Device::name()`; we still use it as both the display
// name and the id. TODO: migrate to the stable `id()` + `description()`.
#[allow(deprecated)]
fn list_inputs() -> AppResult<Vec<DeviceInfo>> {
    let host = cpal::default_host();
    let default_name = host.default_input_device().and_then(|d| d.name().ok());

    let mut out = Vec::new();
    for dev in host
        .input_devices()
        .map_err(|e| AppError::Audio(e.to_string()))?
    {
        let Ok(name) = dev.name() else { continue };
        let is_default = default_name.as_deref() == Some(name.as_str());
        out.push(DeviceInfo {
            id: name.clone(),
            name,
            is_default,
        });
    }
    Ok(out)
}

pub(super) fn list_input_devices() -> AppResult<Vec<DeviceInfo>> {
    list_inputs()
}

/// macOS has no per-output loopback, so the "system audio source" is itself an
/// input device (e.g. BlackHole). Surface the same input list for selection.
pub(super) fn list_output_devices() -> AppResult<Vec<DeviceInfo>> {
    list_inputs()
}
