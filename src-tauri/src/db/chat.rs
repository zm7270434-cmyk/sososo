//! Per-session transcript-chat history (ask-about-this-transcript turns).

use crate::error::AppResult;

use super::{ChatMessage, Db};

impl Db {
    /// All chat turns for a session, oldest first (insertion order).
    pub fn get_chat_messages(&self, session_id: i64) -> AppResult<Vec<ChatMessage>> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, role, content, model, created_at FROM chat_messages \
             WHERE session_id = ?1 ORDER BY id",
        )?;
        let rows = stmt.query_map([session_id], |row| {
            Ok(ChatMessage {
                id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                model: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Append one chat turn and return the persisted row (with its new id).
    pub fn add_chat_message(
        &self,
        session_id: i64,
        role: &str,
        content: &str,
        model: Option<&str>,
        created_at: &str,
    ) -> AppResult<ChatMessage> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO chat_messages (session_id, role, content, model, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![session_id, role, content, model, created_at],
        )?;
        Ok(ChatMessage {
            id: conn.last_insert_rowid(),
            role: role.to_string(),
            content: content.to_string(),
            model: model.map(str::to_string),
            created_at: created_at.to_string(),
        })
    }

    /// Delete all chat turns for a session.
    pub fn clear_chat_messages(&self, session_id: i64) -> AppResult<()> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "DELETE FROM chat_messages WHERE session_id = ?1",
            [session_id],
        )?;
        Ok(())
    }
}
