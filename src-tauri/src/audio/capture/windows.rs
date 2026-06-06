//! Windows capture backend (WASAPI). Loopback captures a *render* (output) device
//! in capture mode; the mic captures an *input* device. Both use polling mode —
//! the loopback stream flag is incompatible with the event-callback flag, so we
//! keep a single polling code path. Runs on a dedicated MTA-COM thread.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use crossbeam_channel::Sender;
use wasapi::{DeviceEnumerator, Direction, SampleType, StreamMode, WaveFormat};

use super::Source;
use crate::audio::{TARGET_CHANNELS, TARGET_SAMPLE_RATE};
use crate::error::{AppError, AppResult};

fn find_device_by_id(
    enumerator: &DeviceEnumerator,
    direction: &Direction,
    id: &str,
) -> AppResult<wasapi::Device> {
    let collection = enumerator
        .get_device_collection(direction)
        .map_err(|e| AppError::Audio(e.to_string()))?;
    for dev in &collection {
        let Ok(dev) = dev else { continue };
        if dev.get_id().map(|d| d == id).unwrap_or(false) {
            return Ok(dev);
        }
    }
    Err(AppError::Audio(format!("device id not found: {id}")))
}

pub(super) fn capture_loop(
    source: Source,
    device_id: Option<String>,
    tx: Sender<Vec<i16>>,
    stop: Arc<AtomicBool>,
) -> AppResult<()> {
    // WASAPI is COM + blocking; this dedicated thread joins the multithreaded apartment.
    wasapi::initialize_mta()
        .ok()
        .map_err(|e| AppError::Audio(format!("COM init: {e}")))?;

    let enumerator = DeviceEnumerator::new().map_err(|e| AppError::Audio(e.to_string()))?;

    // Loopback captures the *render* (output) device; mic the *capture* (input) device.
    let device_dir = match source {
        Source::Loopback => Direction::Render,
        Source::Mic => Direction::Capture,
    };
    let device = match device_id.as_deref() {
        Some(id) => find_device_by_id(&enumerator, &device_dir, id)?,
        None => enumerator
            .get_default_device(&device_dir)
            .map_err(|e| AppError::Audio(format!("no default {device_dir} device: {e}")))?,
    };

    let mut audio_client = device
        .get_iaudioclient()
        .map_err(|e| AppError::Audio(e.to_string()))?;

    // With autoconvert, WASAPI hands us exactly Deepgram-ready PCM — 16-bit signed
    // int, 16 kHz, mono — converting from the device's native format for us.
    let desired = WaveFormat::new(
        16,
        16,
        &SampleType::Int,
        TARGET_SAMPLE_RATE as usize,
        TARGET_CHANNELS as usize,
        None,
    );
    let blockalign = desired.get_blockalign() as usize; // 2 bytes per frame (i16 mono)

    let (default_period, _min_period) = audio_client
        .get_device_period()
        .map_err(|e| AppError::Audio(e.to_string()))?;

    // Polling mode is REQUIRED for loopback (the loopback stream flag is incompatible
    // with the event-callback flag). We use polling for the mic too, for one code path.
    // Device = Render + init direction = Capture => loopback; Capture + Capture => mic.
    let mode = StreamMode::PollingShared {
        autoconvert: true,
        buffer_duration_hns: default_period,
    };
    audio_client
        .initialize_client(&desired, &Direction::Capture, &mode)
        .map_err(|e| AppError::Audio(format!("initialize_client ({source:?}): {e}")))?;

    let capture_client = audio_client
        .get_audiocaptureclient()
        .map_err(|e| AppError::Audio(e.to_string()))?;

    let mut raw: VecDeque<u8> = VecDeque::with_capacity(blockalign * TARGET_SAMPLE_RATE as usize);

    audio_client
        .start_stream()
        .map_err(|e| AppError::Audio(e.to_string()))?;

    // Poll several times per buffer period; loopback delivers nothing during silence,
    // so we never block — we just read whatever is available and sleep.
    let poll = Duration::from_millis(8);

    while !stop.load(Ordering::Relaxed) {
        capture_client
            .read_from_device_to_deque(&mut raw)
            .map_err(|e| AppError::Audio(format!("read ({source:?}): {e}")))?;

        let frames = raw.len() / blockalign;
        if frames > 0 {
            let mut samples = Vec::with_capacity(frames);
            for _ in 0..frames {
                let lo = raw.pop_front().unwrap();
                let hi = raw.pop_front().unwrap();
                samples.push(i16::from_le_bytes([lo, hi]));
            }
            // Non-blocking: drop if the consumer is far behind (favor fresh audio).
            let _ = tx.try_send(samples);
        }

        thread::sleep(poll);
    }

    let _ = audio_client.stop_stream();
    Ok(())
}
