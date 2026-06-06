//! AI meeting-summary generation via the OpenAI Chat Completions API (Milestone E).
//!
//! Invoked by the `summarize_session` command once a transcript exists. The
//! OpenAI key is read from the OS keychain (never the frontend) and the request
//! is sent with the `reqwest` client already in the dependency tree (rustls).
//! The stored transcript is rendered to a speaker-labelled plain-text block and
//! the model is asked for a concise Bahasa Indonesia summary in a fixed Markdown
//! shape (Ringkasan / Poin Penting / Tindak Lanjut).

use std::time::Duration;

use serde::Deserialize;

use crate::db::StoredSegment;
use crate::error::{AppError, AppResult};

/// Default chat model: broadly available, inexpensive, 128k context, and strong
/// at summarization. Kept as a single constant so it is trivial to change.
const MODEL: &str = "gpt-4o-mini";
const ENDPOINT: &str = "https://api.openai.com/v1/chat/completions";
/// Soft cap on transcript characters sent to the model (~15k tokens) so requests
/// stay bounded; longer transcripts are truncated with a visible marker.
const MAX_TRANSCRIPT_CHARS: usize = 60_000;

const SYSTEM_PROMPT: &str = "Anda adalah asisten yang merangkum transkrip rapat atau percakapan ke dalam Bahasa Indonesia yang ringkas, jelas, dan rapi. Gunakan HANYA informasi yang ada di transkrip — jangan mengarang fakta. Dalam transkrip, \"Anda\" adalah pengguna aplikasi (suara mikrofon) dan \"Lawan bicara\" adalah audio dari sistem/peserta lain. Jika transkrip terlalu pendek atau tidak bermakna, sampaikan hal itu dengan singkat alih-alih memaksakan ringkasan.";

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChatMessage,
}

#[derive(Deserialize)]
struct ChatMessage {
    content: String,
}

/// OpenAI error response envelope (`{ "error": { "message": ... } }`).
#[derive(Deserialize)]
struct ApiErrorEnvelope {
    error: ApiErrorBody,
}

#[derive(Deserialize)]
struct ApiErrorBody {
    message: String,
}

/// Render stored transcript segments into a speaker-labelled plain-text block,
/// e.g. `Anda: ...` / `Lawan bicara (pembicara 1): ...`.
pub fn render_transcript(segments: &[StoredSegment]) -> String {
    let mut out = String::new();
    for seg in segments {
        let text = seg.text.trim();
        if text.is_empty() {
            continue;
        }
        let who = if seg.source == "you" {
            "Anda"
        } else {
            "Lawan bicara"
        };
        match seg.speaker.as_deref() {
            Some(s) if !s.is_empty() => out.push_str(&format!("{who} (pembicara {s}): {text}\n")),
            _ => out.push_str(&format!("{who}: {text}\n")),
        }
    }
    if out.len() > MAX_TRANSCRIPT_CHARS {
        let mut cut = MAX_TRANSCRIPT_CHARS;
        while !out.is_char_boundary(cut) {
            cut -= 1;
        }
        out.truncate(cut);
        out.push_str("\n[…transkrip dipotong karena terlalu panjang…]\n");
    }
    out
}

/// Generate a Bahasa Indonesia summary of the transcript. Returns
/// `(summary_markdown, model_used)`.
pub async fn summarize(
    api_key: &str,
    title: &str,
    language: &str,
    segments: &[StoredSegment],
) -> AppResult<(String, String)> {
    let transcript = render_transcript(segments);
    if transcript.trim().is_empty() {
        return Err(AppError::Ai(
            "transkrip kosong, tidak ada yang bisa diringkas".into(),
        ));
    }

    let user_prompt = format!(
        "Judul sesi: {title}\nKode bahasa transkrip: {language}\n\n\
         Buat ringkasan dalam Bahasa Indonesia memakai format Markdown persis seperti ini:\n\n\
         ## Ringkasan\n(2-4 kalimat inti pembicaraan)\n\n\
         ## Poin Penting\n- (poin-poin utama, satu per baris)\n\n\
         ## Tindak Lanjut\n- (keputusan atau action item; tulis \"Tidak ada\" bila memang tidak ada)\n\n\
         Transkrip:\n{transcript}"
    );

    let body = serde_json::json!({
        "model": MODEL,
        "temperature": 0.3,
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT },
            { "role": "user", "content": user_prompt },
        ],
    });

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()?;

    let resp = client
        .post(ENDPOINT)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await?;

    let status = resp.status();
    let raw = resp.text().await?;

    if !status.is_success() {
        let detail = serde_json::from_str::<ApiErrorEnvelope>(&raw)
            .map(|e| e.error.message)
            .unwrap_or_else(|_| raw.clone());
        let hint = if status.as_u16() == 401 {
            " (periksa kembali kunci API OpenAI di Pengaturan)"
        } else {
            ""
        };
        return Err(AppError::Ai(format!("OpenAI {status}: {detail}{hint}")));
    }

    let parsed: ChatResponse = serde_json::from_str(&raw)
        .map_err(|e| AppError::Ai(format!("respons OpenAI tidak terbaca: {e}")))?;
    let summary = parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::Ai("OpenAI tidak mengembalikan ringkasan".into()))?;

    Ok((summary, MODEL.to_string()))
}
