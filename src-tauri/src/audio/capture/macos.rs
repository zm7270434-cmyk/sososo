//! macOS capture backend (CoreAudio via cpal). There is no per-output loopback on
//! macOS, so both the mic and "system audio" are captured as ordinary *input*
//! devices — the latter is expected to be a virtual device such as BlackHole that
//! the user routes their output into.
//!
//! cpal delivers the device's native format/rate/channels via a realtime callback,
//! so we downmix to mono and resample to 16 kHz here to honor the shared contract
//! (16 kHz / 16-bit / mono i16) that the mixer and Deepgram stream expect.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, SizedSample};
use crossbeam_channel::Sender;

use super::Source;
use crate::audio::TARGET_SAMPLE_RATE;
use crate::error::{AppError, AppResult};

pub(super) fn capture_loop(
    source: Source,
    device_id: Option<String>,
    tx: Sender<Vec<i16>>,
    stop: Arc<AtomicBool>,
) -> AppResult<()> {
    let host = cpal::default_host();

    // Both Mic and Loopback resolve to an *input* device on macOS. `device_id` is
    // the device name (cpal has no stable endpoint id like WASAPI).
    let device = match device_id.as_deref() {
        Some(name) => find_input_by_name(&host, name)?,
        None => host
            .default_input_device()
            .ok_or_else(|| AppError::Audio("no default input device".into()))?,
    };

    let supported = device
        .default_input_config()
        .map_err(|e| AppError::Audio(format!("default input config ({source:?}): {e}")))?;
    let sample_format = supported.sample_format();
    let in_rate = supported.sample_rate().0;
    let channels = supported.channels() as usize;
    let config: cpal::StreamConfig = supported.into();

    // Build a typed stream for the device's native sample format. cpal's `Stream`
    // is !Send on macOS, so we build, play and drop it all on this thread; the data
    // callback runs on CoreAudio's own thread.
    let stream = match sample_format {
        cpal::SampleFormat::F32 => {
            build_stream::<f32>(&device, &config, channels, in_rate, tx, source)?
        }
        cpal::SampleFormat::I16 => {
            build_stream::<i16>(&device, &config, channels, in_rate, tx, source)?
        }
        cpal::SampleFormat::U16 => {
            build_stream::<u16>(&device, &config, channels, in_rate, tx, source)?
        }
        other => {
            return Err(AppError::Audio(format!(
                "unsupported input sample format ({source:?}): {other:?}"
            )))
        }
    };

    stream
        .play()
        .map_err(|e| AppError::Audio(format!("play stream ({source:?}): {e}")))?;

    // Hold the stream alive until asked to stop; dropping it stops the capture.
    while !stop.load(Ordering::Relaxed) {
        thread::sleep(Duration::from_millis(50));
    }
    drop(stream);
    Ok(())
}

fn find_input_by_name(host: &cpal::Host, name: &str) -> AppResult<cpal::Device> {
    let devices = host
        .input_devices()
        .map_err(|e| AppError::Audio(e.to_string()))?;
    for dev in devices {
        if dev.name().map(|n| n == name).unwrap_or(false) {
            return Ok(dev);
        }
    }
    Err(AppError::Audio(format!("input device not found: {name}")))
}

fn build_stream<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    channels: usize,
    in_rate: u32,
    tx: Sender<Vec<i16>>,
    source: Source,
) -> AppResult<cpal::Stream>
where
    T: SizedSample,
    f32: FromSample<T>,
{
    let mut resampler = LinearResampler::new(in_rate, TARGET_SAMPLE_RATE);
    let mut mono: Vec<f32> = Vec::new();
    let data_fn = move |data: &[T], _: &cpal::InputCallbackInfo| {
        mono.clear();
        downmix_to_mono::<T>(data, channels, &mut mono);
        let mut out: Vec<i16> = Vec::new();
        resampler.process(&mono, &mut out);
        if !out.is_empty() {
            // Non-blocking: drop if the consumer is far behind (favor fresh audio).
            let _ = tx.try_send(out);
        }
    };
    let err_fn = move |e| eprintln!("[audio] cpal stream error ({source:?}): {e}");
    device
        .build_input_stream(config, data_fn, err_fn, None)
        .map_err(|e| AppError::Audio(format!("build input stream ({source:?}): {e}")))
}

/// Average interleaved frames down to a single mono channel (as f32 in [-1, 1]).
fn downmix_to_mono<T>(data: &[T], channels: usize, out: &mut Vec<f32>)
where
    T: SizedSample,
    f32: FromSample<T>,
{
    if channels <= 1 {
        out.extend(data.iter().map(|&s| f32::from_sample(s)));
        return;
    }
    for frame in data.chunks_exact(channels) {
        let mut acc = 0.0f32;
        for &s in frame {
            acc += f32::from_sample(s);
        }
        out.push(acc / channels as f32);
    }
}

/// Minimal stateful linear resampler: arbitrary input rate -> 16 kHz mono. Good
/// enough for speech STT and avoids pulling in a DSP dependency we cannot test
/// locally (the macOS backend only compiles in CI). Keeps a one-sample tail across
/// callbacks so interpolation stays continuous between buffers.
struct LinearResampler {
    step: f64,
    cursor: f64,
    buf: Vec<f32>,
}

impl LinearResampler {
    fn new(in_rate: u32, out_rate: u32) -> Self {
        Self {
            step: in_rate as f64 / out_rate as f64,
            cursor: 0.0,
            buf: Vec::new(),
        }
    }

    fn process(&mut self, input: &[f32], out: &mut Vec<i16>) {
        self.buf.extend_from_slice(input);
        while (self.cursor as usize) + 1 < self.buf.len() {
            let idx = self.cursor as usize;
            let frac = (self.cursor - idx as f64) as f32;
            let a = self.buf[idx];
            let b = self.buf[idx + 1];
            out.push(to_i16(a + (b - a) * frac));
            self.cursor += self.step;
        }
        // Discard fully-consumed input but keep the sample under the cursor so the
        // next chunk can interpolate against it.
        let consumed = self.cursor.floor() as usize;
        if consumed > 0 {
            self.buf.drain(0..consumed);
            self.cursor -= consumed as f64;
        }
    }
}

fn to_i16(s: f32) -> i16 {
    (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16
}
