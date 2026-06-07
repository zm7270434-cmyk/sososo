//! OpenAI Chat Completions transport.

use std::time::Duration;

use serde::Deserialize;

use crate::error::{AppError, AppResult};

/// OpenAI: broadly available, inexpensive, 128k context, strong at summarization.
pub(crate) const OPENAI_MODEL: &str = "gpt-4o-mini";
const OPENAI_ENDPOINT: &str = "https://api.openai.com/v1/chat/completions";

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

/// OpenAI Chat Completions transport (system + single user turn). Thin wrapper
/// over [`openai_chat_messages`].
pub(crate) async fn openai_chat(
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
pub(crate) async fn openai_chat_messages(
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
