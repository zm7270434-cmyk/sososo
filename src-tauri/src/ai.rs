//! AI meeting-summary generation + live translation via either the OpenAI Chat
//! Completions API or the Google Gemini `generateContent` API (Milestone E).
//!
//! Invoked by the `summarize_session` / `translate_segment` commands. The active
//! provider is a per-app setting (persisted in SQLite); the matching API key is
//! read from the OS keychain (never the frontend) and the request is sent with
//! the `reqwest` client already in the dependency tree (rustls).
//!
//! Both providers share the same prompts and the same transcript rendering — only
//! the HTTP transport (request/response shape, auth header, model name) differs.
//! The stored transcript is rendered to a speaker-labelled plain-text block and
//! the model is asked for a concise summary in a fixed Markdown shape (Summary /
//! Key Points / Action Items). The output language is configurable (`"auto"`
//! follows the transcript language, or a specific language name is requested).

use std::time::Duration;

use serde::Deserialize;

use crate::db::StoredSegment;
use crate::error::{AppError, AppResult};

/// Which AI backend powers summaries + live translation. Persisted as the
/// `ai_provider` app setting; resolved from that string via [`Provider::from_setting`].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Provider {
    OpenAi,
    Gemini,
}

impl Provider {
    /// Parse the persisted setting string; anything unknown falls back to OpenAI.
    pub fn from_setting(s: &str) -> Self {
        match s.trim().to_ascii_lowercase().as_str() {
            "gemini" => Provider::Gemini,
            _ => Provider::OpenAi,
        }
    }

    /// Keychain service name holding this provider's API key.
    pub fn key_service(self) -> &'static str {
        match self {
            Provider::OpenAi => "openai",
            Provider::Gemini => "gemini",
        }
    }

    /// Human-readable name for error/status messages.
    pub fn label(self) -> &'static str {
        match self {
            Provider::OpenAi => "OpenAI",
            Provider::Gemini => "Gemini",
        }
    }
}

/// OpenAI: broadly available, inexpensive, 128k context, strong at summarization.
const OPENAI_MODEL: &str = "gpt-4o-mini";
const OPENAI_ENDPOINT: &str = "https://api.openai.com/v1/chat/completions";

/// Gemini: GA Flash tier — fast & cheap, analogous to `gpt-4o-mini`. Kept as a
/// single constant so it is trivial to change.
const GEMINI_MODEL: &str = "gemini-2.5-flash";
const GEMINI_ENDPOINT_BASE: &str = "https://generativelanguage.googleapis.com/v1beta/models";

/// Soft cap on transcript characters sent to the model (~15k tokens) so requests
/// stay bounded; longer transcripts are truncated with a visible marker.
const MAX_TRANSCRIPT_CHARS: usize = 60_000;

const SYSTEM_PROMPT: &str = "You are an assistant that summarizes meeting or conversation transcripts into a clear, concise, well-structured Markdown summary — use headings, bullet or numbered lists, and **bold** to emphasize key terms. Follow the output-language instruction in the user message exactly. Use ONLY information present in the transcript — do not invent facts. In the transcript, \"You\" is the app user (microphone audio) and \"Other\" is the system/other participants' audio. If the transcript is too short or not meaningful, say so briefly instead of forcing a summary.";

/// System instruction for the per-session transcript chat (`chat_about_transcript`).
/// The full transcript is appended after this in the system message.
const CHAT_SYSTEM_PROMPT: &str = "You are a helpful assistant answering questions about a meeting/conversation transcript. Use ONLY information present in the transcript — do not invent facts. If the answer is not in the transcript, say so clearly. In the transcript, \"You\" is the app user (microphone audio) and \"Other\" is the system/other participants' audio. Reply in the SAME language as the user's question. Keep answers concise; you may use simple Markdown (headings, **bold**, lists) for clarity.";

// --- OpenAI response/error envelopes ---

#[derive(Deserialize)]
struct OpenAiChatResponse {
    choices: Vec<OpenAiChoice>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessage,
}

#[derive(Deserialize)]
struct OpenAiMessage {
    content: String,
}

/// OpenAI error response envelope (`{ "error": { "message": ... } }`).
#[derive(Deserialize)]
struct OpenAiErrorEnvelope {
    error: OpenAiErrorBody,
}

#[derive(Deserialize)]
struct OpenAiErrorBody {
    message: String,
}

// --- Gemini response/error envelopes ---

#[derive(Deserialize)]
struct GeminiResponse {
    #[serde(default)]
    candidates: Vec<GeminiCandidate>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    // Absent when a candidate was blocked (e.g. safety) instead of producing text.
    content: Option<GeminiContent>,
}

#[derive(Deserialize)]
struct GeminiContent {
    #[serde(default)]
    parts: Vec<GeminiPart>,
}

#[derive(Deserialize)]
struct GeminiPart {
    #[serde(default)]
    text: String,
}

/// Gemini error response envelope (`{ "error": { "message": ... } }`).
#[derive(Deserialize)]
struct GeminiErrorEnvelope {
    error: GeminiErrorBody,
}

#[derive(Deserialize)]
struct GeminiErrorBody {
    message: String,
}

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

/// Provider-agnostic single-turn chat: given a system instruction + user content,
/// returns the model's text reply and the model name used. Dispatches to the
/// right transport based on `provider`.
async fn chat(
    provider: Provider,
    api_key: &str,
    system: &str,
    user: &str,
    temperature: f32,
    timeout: Duration,
) -> AppResult<(String, String)> {
    match provider {
        Provider::OpenAi => {
            let text = openai_chat(api_key, system, user, temperature, timeout).await?;
            Ok((text, OPENAI_MODEL.to_string()))
        }
        Provider::Gemini => {
            let text = gemini_chat(api_key, system, user, temperature, timeout).await?;
            Ok((text, GEMINI_MODEL.to_string()))
        }
    }
}

/// OpenAI Chat Completions transport (system + single user turn). Thin wrapper
/// over [`openai_chat_messages`].
async fn openai_chat(
    api_key: &str,
    system: &str,
    user: &str,
    temperature: f32,
    timeout: Duration,
) -> AppResult<String> {
    let messages = serde_json::json!([
        { "role": "system", "content": system },
        { "role": "user", "content": user },
    ]);
    openai_chat_messages(api_key, messages, temperature, timeout).await
}

/// OpenAI Chat Completions transport given a fully-built `messages` array (so
/// multi-turn chats can include prior turns alongside the system + user message).
async fn openai_chat_messages(
    api_key: &str,
    messages: serde_json::Value,
    temperature: f32,
    timeout: Duration,
) -> AppResult<String> {
    let body = serde_json::json!({
        "model": OPENAI_MODEL,
        "temperature": temperature,
        "messages": messages,
    });

    let client = reqwest::Client::builder().timeout(timeout).build()?;
    let resp = client
        .post(OPENAI_ENDPOINT)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await?;

    let status = resp.status();
    let raw = resp.text().await?;

    if !status.is_success() {
        let detail = serde_json::from_str::<OpenAiErrorEnvelope>(&raw)
            .map(|e| e.error.message)
            .unwrap_or_else(|_| raw.clone());
        let hint = if status.as_u16() == 401 {
            " (check the OpenAI API key in Settings)"
        } else {
            ""
        };
        return Err(AppError::Ai(format!("OpenAI {status}: {detail}{hint}")));
    }

    let parsed: OpenAiChatResponse = serde_json::from_str(&raw)
        .map_err(|e| AppError::Ai(format!("could not parse OpenAI response: {e}")))?;
    parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::Ai("OpenAI returned no content".into()))
}

/// Google Gemini `generateContent` transport. The system prompt maps to
/// `systemInstruction`; the user content to a single `contents` turn. Auth is the
/// `x-goog-api-key` header (the key is never placed in the URL/query string).
async fn gemini_chat(
    api_key: &str,
    system: &str,
    user: &str,
    temperature: f32,
    timeout: Duration,
) -> AppResult<String> {
    let contents = serde_json::json!([ { "role": "user", "parts": [ { "text": user } ] } ]);
    gemini_chat_messages(api_key, system, contents, temperature, timeout).await
}

/// Gemini `generateContent` transport given a fully-built `contents` array (for
/// multi-turn chats). Note Gemini uses the role `"model"` (not `"assistant"`) for
/// prior model turns — callers must map accordingly when building `contents`.
async fn gemini_chat_messages(
    api_key: &str,
    system: &str,
    contents: serde_json::Value,
    temperature: f32,
    timeout: Duration,
) -> AppResult<String> {
    let url = format!("{GEMINI_ENDPOINT_BASE}/{GEMINI_MODEL}:generateContent");
    let body = serde_json::json!({
        "systemInstruction": { "parts": [ { "text": system } ] },
        "contents": contents,
        "generationConfig": { "temperature": temperature },
    });

    let client = reqwest::Client::builder().timeout(timeout).build()?;
    let resp = client
        .post(&url)
        .header("x-goog-api-key", api_key)
        .json(&body)
        .send()
        .await?;

    let status = resp.status();
    let raw = resp.text().await?;

    if !status.is_success() {
        let detail = serde_json::from_str::<GeminiErrorEnvelope>(&raw)
            .map(|e| e.error.message)
            .unwrap_or_else(|_| raw.clone());
        let hint = match status.as_u16() {
            400 | 401 | 403 => " (check the Gemini API key in Settings)",
            _ => "",
        };
        return Err(AppError::Ai(format!("Gemini {status}: {detail}{hint}")));
    }

    let parsed: GeminiResponse = serde_json::from_str(&raw)
        .map_err(|e| AppError::Ai(format!("could not parse Gemini response: {e}")))?;
    parsed
        .candidates
        .into_iter()
        .next()
        .and_then(|c| c.content)
        .and_then(|c| c.parts.into_iter().next())
        .map(|p| p.text.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::Ai("Gemini returned no content".into()))
}

/// Generate a summary of the transcript via `provider`. `summary_language` is the
/// desired output language: the literal `"auto"` (match the transcript's language)
/// or a human-readable language name like `"English"` / `"Indonesian"`. Returns
/// `(summary_markdown, model_used)`.
pub async fn summarize(
    provider: Provider,
    api_key: &str,
    title: &str,
    language: &str,
    summary_language: &str,
    segments: &[StoredSegment],
) -> AppResult<(String, String)> {
    let transcript = render_transcript(segments);
    if transcript.trim().is_empty() {
        return Err(AppError::Ai(
            "transcript is empty, nothing to summarize".into(),
        ));
    }

    let language_directive = if summary_language.eq_ignore_ascii_case("auto") {
        "Write the summary in the SAME language as the transcript.".to_string()
    } else {
        format!(
            "Write the entire summary — including the section headings — in {summary_language}."
        )
    };

    let user_prompt = format!(
        "Session title: {title}\nTranscript language code: {language}\n\n\
         {language_directive} Format the summary as clean Markdown using exactly this \
         structure (translate the section headings into the output language too). Use \
         **bold** for key terms, names, decisions, dates, and numbers so it is easy to \
         skim, and *italic* for nuance where helpful:\n\n\
         ## Summary\n(2-4 sentences of the core discussion)\n\n\
         ## Key Points\n- (the main points, one per line; **bold** the crucial term in each)\n\n\
         ## Action Items\n1. (decisions or action items as a numbered list; **bold** the \
         owner/decision)\n(if there are none, write a single line: None)\n\n\
         Transcript:\n{transcript}"
    );

    chat(
        provider,
        api_key,
        SYSTEM_PROMPT,
        &user_prompt,
        0.3,
        Duration::from_secs(90),
    )
    .await
}

/// Translate a single finalized transcript line into `target_language` (a
/// human-readable name like "English") via `provider`. Returns ONLY the
/// translated text.
///
/// Invoked by the `translate_segment` command for live, per-segment translation,
/// so it is kept lightweight: a short timeout (it runs many times per session)
/// and a low temperature for faithful output.
pub async fn translate(
    provider: Provider,
    api_key: &str,
    text: &str,
    target_language: &str,
) -> AppResult<String> {
    let text = text.trim();
    if text.is_empty() {
        return Err(AppError::Ai("nothing to translate".into()));
    }

    let system_prompt = format!(
        "You are a professional real-time translation engine. Translate the user's text into \
         {target_language}. Output ONLY the translation — no quotes, no notes, no preamble, no \
         transliteration. Preserve meaning, names, and tone. If the text is already in \
         {target_language}, return it unchanged."
    );

    let (translated, _model) = chat(
        provider,
        api_key,
        &system_prompt,
        text,
        0.2,
        Duration::from_secs(30),
    )
    .await?;
    Ok(translated)
}

/// One prior turn of a transcript chat, passed to [`chat_about_transcript`].
/// `role` is `"user"` or `"assistant"` (Gemini's `"model"` mapping is internal).
pub struct ChatTurn {
    pub role: String,
    pub content: String,
}

/// Answer a free-form question about a session's transcript via `provider`, given
/// the prior conversation `history`. The full transcript (speaker-labelled, capped
/// by [`render_transcript`]) is sent as the system context every turn; `history`
/// carries the running dialogue. Returns `(reply_text, model_used)`.
///
/// Like [`summarize`], this performs a single non-streaming request. Temperature is
/// a touch higher than summaries for more natural answers, with a 60s timeout.
pub async fn chat_about_transcript(
    provider: Provider,
    api_key: &str,
    title: &str,
    segments: &[StoredSegment],
    history: &[ChatTurn],
    question: &str,
) -> AppResult<(String, String)> {
    let question = question.trim();
    if question.is_empty() {
        return Err(AppError::Ai("question is empty".into()));
    }
    let transcript = render_transcript(segments);
    if transcript.trim().is_empty() {
        return Err(AppError::Ai(
            "transcript is empty, nothing to chat about".into(),
        ));
    }

    let system =
        format!("{CHAT_SYSTEM_PROMPT}\n\nSession title: {title}\n\nTranscript:\n{transcript}");
    let temperature = 0.4;
    let timeout = Duration::from_secs(60);

    match provider {
        Provider::OpenAi => {
            let mut messages: Vec<serde_json::Value> = Vec::with_capacity(history.len() + 2);
            messages.push(serde_json::json!({ "role": "system", "content": system }));
            for turn in history {
                messages.push(serde_json::json!({ "role": turn.role, "content": turn.content }));
            }
            messages.push(serde_json::json!({ "role": "user", "content": question }));
            let text = openai_chat_messages(
                api_key,
                serde_json::Value::Array(messages),
                temperature,
                timeout,
            )
            .await?;
            Ok((text, OPENAI_MODEL.to_string()))
        }
        Provider::Gemini => {
            let mut contents: Vec<serde_json::Value> = Vec::with_capacity(history.len() + 1);
            for turn in history {
                // Gemini names the assistant role "model"; the user role matches.
                let role = if turn.role == "assistant" {
                    "model"
                } else {
                    "user"
                };
                contents.push(
                    serde_json::json!({ "role": role, "parts": [ { "text": turn.content } ] }),
                );
            }
            contents.push(serde_json::json!({ "role": "user", "parts": [ { "text": question } ] }));
            let text = gemini_chat_messages(
                api_key,
                &system,
                serde_json::Value::Array(contents),
                temperature,
                timeout,
            )
            .await?;
            Ok((text, GEMINI_MODEL.to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::StoredSegment;

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

    #[test]
    fn provider_from_setting_is_case_insensitive_and_defaults_to_openai() {
        assert_eq!(Provider::from_setting("gemini"), Provider::Gemini);
        assert_eq!(Provider::from_setting("  GEMINI "), Provider::Gemini);
        assert_eq!(Provider::from_setting("openai"), Provider::OpenAi);
        assert_eq!(Provider::from_setting(""), Provider::OpenAi);
        assert_eq!(Provider::from_setting("something-else"), Provider::OpenAi);
    }

    #[test]
    fn provider_exposes_keychain_service_names() {
        assert_eq!(Provider::OpenAi.key_service(), "openai");
        assert_eq!(Provider::Gemini.key_service(), "gemini");
    }
}
