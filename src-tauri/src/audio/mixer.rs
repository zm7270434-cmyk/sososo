use std::collections::VecDeque;

/// Interleaves two mono 16 kHz i16 streams — mic (channel 0) and system (channel 1)
/// — into a single 2-channel interleaved stream: `[mic0, sys0, mic1, sys1, ...]`.
///
/// The two WASAPI endpoints run on independent clocks and can drift over long
/// sessions. We bound that by emitting only `min(mic, sys)` paired frames and, if
/// one channel races ahead beyond `max_skew`, padding the starved channel with
/// silence so the paired output stays time-aligned instead of drifting forever.
pub struct Interleaver {
    mic: VecDeque<i16>,
    sys: VecDeque<i16>,
    max_skew: usize,
}

impl Interleaver {
    pub fn new(max_skew_samples: usize) -> Self {
        Self {
            mic: VecDeque::new(),
            sys: VecDeque::new(),
            max_skew: max_skew_samples,
        }
    }

    pub fn push_mic(&mut self, samples: &[i16]) {
        self.mic.extend(samples.iter().copied());
        self.bound_skew();
    }

    pub fn push_system(&mut self, samples: &[i16]) {
        self.sys.extend(samples.iter().copied());
        self.bound_skew();
    }

    fn bound_skew(&mut self) {
        if self.mic.len() > self.sys.len() + self.max_skew {
            // System starved: pad it with silence to catch up to mic's timeline.
            let pad = self.mic.len() - self.sys.len() - self.max_skew;
            self.sys.extend(std::iter::repeat_n(0, pad));
        } else if self.sys.len() > self.mic.len() + self.max_skew {
            let pad = self.sys.len() - self.mic.len() - self.max_skew;
            self.mic.extend(std::iter::repeat_n(0, pad));
        }
    }

    /// Drain all currently-pairable frames as interleaved 16-bit little-endian bytes
    /// (the wire format for Deepgram: 2 channels, 16-bit LE).
    pub fn drain_interleaved_bytes(&mut self) -> Vec<u8> {
        let n = self.mic.len().min(self.sys.len());
        let mut out = Vec::with_capacity(n * 4);
        for _ in 0..n {
            let m = self.mic.pop_front().unwrap();
            let s = self.sys.pop_front().unwrap();
            out.extend_from_slice(&m.to_le_bytes());
            out.extend_from_slice(&s.to_le_bytes());
        }
        out
    }

    /// Drain all currently-pairable frames as interleaved i16 pairs
    /// (handy for WAV writing / inspection).
    pub fn drain_interleaved_i16(&mut self) -> Vec<i16> {
        let n = self.mic.len().min(self.sys.len());
        let mut out = Vec::with_capacity(n * 2);
        for _ in 0..n {
            out.push(self.mic.pop_front().unwrap());
            out.push(self.sys.pop_front().unwrap());
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interleaves_mic_and_system_in_order() {
        let mut ix = Interleaver::new(1024);
        ix.push_mic(&[1, 2]);
        ix.push_system(&[10, 20]);
        assert_eq!(ix.drain_interleaved_i16(), vec![1, 10, 2, 20]);
    }

    #[test]
    fn drains_interleaved_frames_as_little_endian_bytes() {
        let mut ix = Interleaver::new(1024);
        ix.push_mic(&[1, 2]);
        ix.push_system(&[10, 20]);
        // 2-channel 16-bit LE: 1->[1,0], 10->[10,0], 2->[2,0], 20->[20,0].
        assert_eq!(ix.drain_interleaved_bytes(), vec![1, 0, 10, 0, 2, 0, 20, 0]);
    }

    #[test]
    fn drains_only_paired_frames_and_keeps_the_remainder() {
        let mut ix = Interleaver::new(1024);
        ix.push_mic(&[1, 2, 3]);
        ix.push_system(&[10]);
        // Only one pair is drainable now; the extra mic samples wait.
        assert_eq!(ix.drain_interleaved_i16(), vec![1, 10]);
        ix.push_system(&[20, 30]);
        assert_eq!(ix.drain_interleaved_i16(), vec![2, 20, 3, 30]);
    }

    #[test]
    fn drain_on_empty_streams_yields_nothing() {
        let mut ix = Interleaver::new(1024);
        assert!(ix.drain_interleaved_i16().is_empty());
        assert!(ix.drain_interleaved_bytes().is_empty());
    }

    #[test]
    fn pads_starved_system_channel_with_silence_past_max_skew() {
        let mut ix = Interleaver::new(2);
        ix.push_mic(&[1, 2, 3, 4, 5]); // mic races ahead of an idle system
                                       // system is padded by 5 - 0 - 2 = 3 silent samples → 3 drainable pairs.
        assert_eq!(ix.drain_interleaved_i16(), vec![1, 0, 2, 0, 3, 0]);
    }

    #[test]
    fn pads_starved_mic_channel_with_silence_past_max_skew() {
        let mut ix = Interleaver::new(2);
        ix.push_system(&[10, 20, 30, 40, 50]);
        assert_eq!(ix.drain_interleaved_i16(), vec![0, 10, 0, 20, 0, 30]);
    }
}
