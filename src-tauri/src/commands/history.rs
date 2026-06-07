//! Session-history commands (Milestone D): list, fetch, search, delete, rename.

use tauri::State;

use crate::db::{Db, SearchHit, SessionDetail, SessionSummary};
use crate::error::{AppError, AppResult};

/// All recorded sessions (newest first) for the history sidebar.
#[tauri::command]
pub fn list_sessions(db: State<'_, Db>) -> AppResult<Vec<SessionSummary>> {
    db.list_sessions()
}

/// One session plus its full stored transcript, or `None` if it was deleted.
#[tauri::command]
pub fn get_session(db: State<'_, Db>, id: i64) -> AppResult<Option<SessionDetail>> {
    db.get_session(id)
}

/// Full-text search across all saved transcripts (FTS5). Returns one hit per
/// matching session (most relevant first) with a highlighted snippet.
#[tauri::command]
pub fn search_sessions(db: State<'_, Db>, query: String) -> AppResult<Vec<SearchHit>> {
    db.search_sessions(&query)
}

/// Delete a recorded session and its transcript (cascades to segments).
#[tauri::command]
pub fn delete_session(db: State<'_, Db>, id: i64) -> AppResult<()> {
    db.delete_session(id)
}

/// Rename a recorded session.
#[tauri::command]
pub fn rename_session(db: State<'_, Db>, id: i64, title: String) -> AppResult<()> {
    db.rename_session(id, &title)
}

/// Rename a speaker label across a saved session's transcript (history view).
/// `from` is the current stored label (`null`/`None` = the un-diarized group);
/// `to` is the new name. An empty `to` is rejected. Returns rows changed.
#[tauri::command]
pub fn rename_speaker(
    db: State<'_, Db>,
    session_id: i64,
    from: Option<String>,
    to: String,
) -> AppResult<usize> {
    let to = to.trim();
    if to.is_empty() {
        return Err(AppError::Session("Speaker name cannot be empty".into()));
    }
    db.rename_speaker(session_id, from.as_deref(), to)
}
