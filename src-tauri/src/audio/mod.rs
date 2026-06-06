pub mod capture;
pub mod devices;
pub mod mixer;

/// PCM format we negotiate from WASAPI (via autoconvert) and feed to Deepgram.
/// Each source is captured as 16 kHz, 16-bit signed, mono; the mixer then
/// interleaves mic + system into a 2-channel stream.
pub const TARGET_SAMPLE_RATE: u32 = 16_000;
pub const TARGET_CHANNELS: u16 = 1;
