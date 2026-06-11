use serde::Serialize;

/// Emitted globally; both windows listen globally (see frontend `lib/events.ts`).
pub const SESSION_STATE: &str = "session://state";
pub const TRANSCRIPT_SEGMENT: &str = "transcript://segment";
/// Global hotkey / tray "toggle recording" press (no payload); the frontend
/// turns it into start/stop/ignore from its session state.
pub const RECORDING_TOGGLE: &str = "recording://toggle";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionState {
    pub session_id: Option<i64>,
    /// idle | starting | recording | stopping | stopped | reconnecting | error
    pub state: String,
    pub started_at: Option<String>,
    pub error: Option<String>,
}

impl SessionState {
    pub fn new(session_id: Option<i64>, state: &str) -> Self {
        Self {
            session_id,
            state: state.to_string(),
            started_at: None,
            error: None,
        }
    }
    pub fn with_started(mut self, ts: String) -> Self {
        self.started_at = Some(ts);
        self
    }
    pub fn with_error(mut self, e: String) -> Self {
        self.error = Some(e);
        self
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptSegment {
    pub session_id: i64,
    /// Stable across interim updates of the same utterance; the frontend replaces by id.
    pub segment_id: String,
    /// "you" (mic / channel 0) | "remote" (system / channel 1)
    pub source: String,
    pub speaker: Option<String>,
    pub text: String,
    pub t_start: f64,
    pub t_end: Option<f64>,
    pub is_final: bool,
    pub confidence: Option<f64>,
}
