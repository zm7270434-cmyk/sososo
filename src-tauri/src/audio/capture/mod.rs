use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};

use crossbeam_channel::{bounded, Receiver};

use crate::error::{AppError, AppResult};

// Per-OS capture backend. Each implements `capture_loop` with the same signature
// and feeds 16 kHz / 16-bit / mono `Vec<i16>` chunks into the shared channel.
#[cfg(target_os = "windows")]
#[path = "windows.rs"]
mod platform;
#[cfg(target_os = "macos")]
#[path = "macos.rs"]
mod platform;

/// A running capture of one source, delivering 16 kHz / 16-bit / mono PCM as
/// `Vec<i16>` chunks over `rx`. The realtime capture work runs on its own thread.
pub struct CaptureHandle {
    pub rx: Receiver<Vec<i16>>,
    stop: Arc<AtomicBool>,
    join: Option<JoinHandle<()>>,
}

impl CaptureHandle {
    /// Signal the capture thread to stop and wait for it to finish.
    pub fn stop(mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(j) = self.join.take() {
            let _ = j.join();
        }
    }
}

impl Drop for CaptureHandle {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(j) = self.join.take() {
            let _ = j.join();
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub(crate) enum Source {
    /// System output (what you hear). Windows: WASAPI loopback of a render device.
    /// macOS: a capture of an input device that carries system audio (e.g. BlackHole).
    Loopback,
    /// Microphone / default input.
    Mic,
}

/// Start capturing system audio. `device_id` selects the source device, or `None`
/// for the system default. (Windows: an output device to loopback; macOS: an input
/// device carrying system audio.)
pub fn start_loopback_capture(device_id: Option<String>) -> AppResult<CaptureHandle> {
    start_capture(Source::Loopback, device_id)
}

/// Start capturing the microphone. `device_id` selects the input device, or `None`
/// for the system default.
pub fn start_mic_capture(device_id: Option<String>) -> AppResult<CaptureHandle> {
    start_capture(Source::Mic, device_id)
}

fn start_capture(source: Source, device_id: Option<String>) -> AppResult<CaptureHandle> {
    // Small bounded channel: if the consumer lags we drop fresh chunks rather
    // than let latency grow unbounded.
    let (tx, rx) = bounded::<Vec<i16>>(64);
    let stop = Arc::new(AtomicBool::new(false));
    let stop_thread = stop.clone();

    let name = match source {
        Source::Loopback => "cap-loopback",
        Source::Mic => "cap-mic",
    };

    let join = thread::Builder::new()
        .name(name.to_string())
        .spawn(move || {
            if let Err(e) = platform::capture_loop(source, device_id, tx, stop_thread) {
                eprintln!("[audio] {source:?} capture stopped: {e}");
            }
        })
        .map_err(|e| AppError::Audio(format!("spawn capture thread: {e}")))?;

    Ok(CaptureHandle {
        rx,
        stop,
        join: Some(join),
    })
}
