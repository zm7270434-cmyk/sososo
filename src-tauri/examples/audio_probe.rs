//! Milestone B verification harness.
//!
//! Run with:  cargo run --example audio_probe -- 6
//!
//! Enumerates devices, captures the microphone AND system loopback for N seconds,
//! interleaves them (L = mic, R = system), prints per-channel RMS, and writes
//! `audio_probe.wav` so you can listen back. Play a YouTube video and speak while
//! it runs to confirm BOTH channels carry audio.

use std::time::{Duration, Instant};

use sososo_lib::audio::{capture, devices, mixer::Interleaver, TARGET_SAMPLE_RATE};

fn rms(samples: &[i16]) -> f64 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum: f64 = samples.iter().map(|&s| (s as f64) * (s as f64)).sum();
    (sum / samples.len() as f64).sqrt()
}

fn main() {
    let secs: u64 = std::env::args()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(6);

    println!("== Input (microphone) devices ==");
    for d in devices::list_input_devices().expect("list inputs") {
        println!("  {} {}", if d.is_default { "*" } else { " " }, d.name);
    }
    println!("== Output devices (loopback sources) ==");
    for d in devices::list_output_devices().expect("list outputs") {
        println!("  {} {}", if d.is_default { "*" } else { " " }, d.name);
    }

    println!("\nCapturing {secs}s — play some audio and speak to exercise both channels...");
    let mic = capture::start_mic_capture(None).expect("start mic capture");
    let sys = capture::start_loopback_capture(None).expect("start loopback capture");

    // ~200 ms of skew tolerance before silence-padding the starved channel.
    let mut interleaver = Interleaver::new(TARGET_SAMPLE_RATE as usize / 5);
    let mut mic_all: Vec<i16> = Vec::new();
    let mut sys_all: Vec<i16> = Vec::new();

    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(secs) {
        while let Ok(chunk) = mic.rx.try_recv() {
            mic_all.extend_from_slice(&chunk);
            interleaver.push_mic(&chunk);
        }
        while let Ok(chunk) = sys.rx.try_recv() {
            sys_all.extend_from_slice(&chunk);
            interleaver.push_system(&chunk);
        }
        std::thread::sleep(Duration::from_millis(20));
    }

    mic.stop();
    sys.stop();

    let interleaved = interleaver.drain_interleaved_i16();
    let frames = interleaved.len() / 2;

    println!("\n--- Results ---");
    println!(
        "  mic: {} samples (~{:.1}s @16k), RMS {:.1}",
        mic_all.len(),
        mic_all.len() as f64 / TARGET_SAMPLE_RATE as f64,
        rms(&mic_all)
    );
    println!(
        "  sys: {} samples (~{:.1}s @16k), RMS {:.1}",
        sys_all.len(),
        sys_all.len() as f64 / TARGET_SAMPLE_RATE as f64,
        rms(&sys_all)
    );
    println!("  interleaved paired frames: {frames}");

    let spec = hound::WavSpec {
        channels: 2,
        sample_rate: TARGET_SAMPLE_RATE,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut w = hound::WavWriter::create("audio_probe.wav", spec).expect("create wav");
    for s in &interleaved {
        w.write_sample(*s).expect("write sample");
    }
    w.finalize().expect("finalize wav");
    println!("  wrote audio_probe.wav  (L = mic, R = system)");

    if mic_all.is_empty() && sys_all.is_empty() {
        println!("\nWARNING: no audio captured on either channel.");
    } else {
        println!("\nOK: capture pipeline ran without error.");
    }
}
