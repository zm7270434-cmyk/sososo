//! Render stored transcript segments into the speaker-labelled plain-text block
//! sent to the model.

use crate::db::StoredSegment;

/// Soft cap on transcript characters sent to the model (~15k tokens) so requests
/// stay bounded; longer transcripts are truncated with a visible marker.
const MAX_TRANSCRIPT_CHARS: usize = 60_000;

/// Render stored transcript segments into a speaker-labelled plain-text block,
/// e.g. `You: ...` / `Other (speaker 1): ...`.
pub fn render_transcript(segments: &[StoredSegment]) -> String {
    let mut out = String::new();
    for seg in segments {
        let text = seg.text.trim();
        if text.is_empty() {
            continue;
        }
        let who = if seg.source == "you" { "You" } else { "Other" };
        match seg.speaker.as_deref() {
            Some(s) if !s.is_empty() => out.push_str(&format!("{who} (speaker {s}): {text}\n")),
            _ => out.push_str(&format!("{who}: {text}\n")),
        }
    }
    if out.len() > MAX_TRANSCRIPT_CHARS {
        let mut cut = MAX_TRANSCRIPT_CHARS;
        while !out.is_char_boundary(cut) {
            cut -= 1;
        }
        out.truncate(cut);
        out.push_str("\n[…transcript truncated (too long)…]\n");
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seg(source: &str, speaker: Option<&str>, text: &str) -> StoredSegment {
        StoredSegment {
            segment_id: "s".into(),
            source: source.into(),
            speaker: speaker.map(|s| s.into()),
            text: text.into(),
            t_start: 0.0,
            t_end: None,
            confidence: None,
            translation: None,
            translation_lang: None,
        }
    }

    #[test]
    fn render_transcript_labels_you_and_other_with_optional_speaker() {
        let segs = [
            seg("you", None, "hi there"),
            seg("remote", Some("1"), "hello"),
            seg("remote", None, "yo"),
        ];
        assert_eq!(
            render_transcript(&segs),
            "You: hi there\nOther (speaker 1): hello\nOther: yo\n"
        );
    }

    #[test]
    fn render_transcript_skips_blank_lines_and_trims_text() {
        let segs = [seg("you", None, "   "), seg("you", None, "  real  ")];
        assert_eq!(render_transcript(&segs), "You: real\n");
    }

    #[test]
    fn render_transcript_on_no_segments_is_empty() {
        assert_eq!(render_transcript(&[]), "");
    }

    #[test]
    fn render_transcript_truncates_overlong_input_at_a_char_boundary() {
        // Multibyte text far past the cap: the cut must not split a char (that
        // would panic) and the output must end with the truncation marker.
        let long = "é".repeat(40_000); // 80_000 bytes >> MAX_TRANSCRIPT_CHARS
        let out = render_transcript(&[seg("you", None, &long)]);
        assert!(out.contains("transcript truncated"));
        assert!(out.starts_with("You: "));
        assert!(out.len() <= MAX_TRANSCRIPT_CHARS + 64);
    }
}
