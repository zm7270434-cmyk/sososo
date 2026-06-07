//! AI backend selection.

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

#[cfg(test)]
mod tests {
    use super::*;

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
