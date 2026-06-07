//! Linux device enumeration (PulseAudio / PipeWire via libpulse). Microphones are
//! non-monitor PA sources; "system audio" sources are sink monitors (every output
//! sink has one), so — unlike macOS — no virtual loopback device needs installing.

use super::DeviceInfo;
use crate::audio::pulse as pa;
use crate::error::AppResult;

fn to_device_info(e: pa::PaEndpoint) -> DeviceInfo {
    DeviceInfo {
        id: e.id,
        name: e.name,
        is_default: e.is_default,
    }
}

pub(super) fn list_input_devices() -> AppResult<Vec<DeviceInfo>> {
    Ok(pa::list_input_sources()?
        .into_iter()
        .map(to_device_info)
        .collect())
}

pub(super) fn list_output_devices() -> AppResult<Vec<DeviceInfo>> {
    Ok(pa::list_monitor_sources()?
        .into_iter()
        .map(to_device_info)
        .collect())
}
