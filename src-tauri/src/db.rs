//! SQLite persistence for sessions + transcript history (Milestone D).
//!
//! A single long-lived connection guarded by a `Mutex` is kept in Tauri-managed
//! state. Writes during a session are infrequent (one row per *final* segment),
//! so the mutex is never held long enough to matter. The connection is opened in
//! `lib.rs setup()` once the app data directory is known.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;

use crate::error::AppResult;
use crate::events::TranscriptSegment;

const SCHEMA: &str = "
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT    NOT NULL,
    language      TEXT    NOT NULL,
    system_only   INTEGER NOT NULL DEFAULT 0,
    started_at    TEXT    NOT NULL,
    ended_at      TEXT,
    summary       TEXT,
    summary_model TEXT,
    summarized_at TEXT
);

CREATE TABLE IF NOT EXISTS segments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    segment_id  TEXT    NOT NULL,
    source      TEXT    NOT NULL,
    speaker     TEXT,
    text        TEXT    NOT NULL,
    t_start     REAL    NOT NULL,
    t_end       REAL,
    confidence  REAL,
    translation      TEXT,
    translation_lang TEXT,
    UNIQUE (session_id, segment_id)
);

CREATE INDEX IF NOT EXISTS idx_segments_session ON segments(session_id, t_start, id);

CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Chat (ask-about-this-transcript) history, one row per turn, scoped to a
-- session. `model` is the AI model name for assistant rows (NULL for the user's
-- questions). Rows cascade-delete with their session.
CREATE TABLE IF NOT EXISTS chat_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role        TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    model       TEXT,
    created_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, id);

-- Full-text index over transcript text (FTS5, external-content = `segments`), so
-- the library can search across every transcript. Triggers keep it in sync; the
-- AFTER UPDATE one only re-indexes when `text` actually changes (rename-speaker
-- and save-translation touch other columns). Pre-existing rows are backfilled in
-- `migrate()`. FTS5 ships with rusqlite's `bundled` SQLite.
CREATE VIRTUAL TABLE IF NOT EXISTS segments_fts USING fts5(
    text,
    content = 'segments',
    content_rowid = 'id'
);

CREATE TRIGGER IF NOT EXISTS segments_ai AFTER INSERT ON segments BEGIN
    INSERT INTO segments_fts(rowid, text) VALUES (new.id, new.text);
END;
CREATE TRIGGER IF NOT EXISTS segments_ad AFTER DELETE ON segments BEGIN
    INSERT INTO segments_fts(segments_fts, rowid, text) VALUES ('delete', old.id, old.text);
END;
CREATE TRIGGER IF NOT EXISTS segments_au AFTER UPDATE ON segments
    WHEN new.text IS NOT old.text BEGIN
    INSERT INTO segments_fts(segments_fts, rowid, text) VALUES ('delete', old.id, old.text);
    INSERT INTO segments_fts(rowid, text) VALUES (new.id, new.text);
END;
";

/// One row of the session history list (with a transcript segment count).
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: i64,
    pub title: String,
    pub language: String,
    pub system_only: bool,
    pub started_at: String,
    pub ended_at: Option<String>,
    /// AI summary (Markdown) and its provenance; `None` until generated (Milestone E).
    pub summary: Option<String>,
    pub summary_model: Option<String>,
    pub summarized_at: Option<String>,
    pub segment_count: i64,
}

/// A stored transcript line (the persisted shape of a final `TranscriptSegment`).
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StoredSegment {
    /// Stable per-line id (`{session}:{channel}:{start}`). Exposed so the history
    /// view can (re)translate a saved line via `translate_segment`.
    pub segment_id: String,
    pub source: String,
    pub speaker: Option<String>,
    pub text: String,
    pub t_start: f64,
    pub t_end: Option<f64>,
    pub confidence: Option<f64>,
    /// Live-translation of `text` (Milestone: live translate), or `None` if the
    /// line was never translated. `translation_lang` records the target language.
    pub translation: Option<String>,
    pub translation_lang: Option<String>,
}

/// A session plus its full transcript, for the detail view.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionDetail {
    pub session: SessionSummary,
    pub segments: Vec<StoredSegment>,
}

/// One full-text search result: a matching session with a highlighted snippet of
/// its best-matching line and how many of its lines matched.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub session_id: i64,
    pub title: String,
    pub started_at: String,
    /// Excerpt of the best-matching line with matched terms wrapped in `[`…`]`.
    pub snippet: String,
    pub match_count: i64,
}

/// One turn of the per-session transcript chat. `role` is `"user"` or
/// `"assistant"`; `model` is the AI model that produced an assistant reply
/// (`None` for the user's questions).
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: i64,
    pub role: String,
    pub content: String,
    pub model: Option<String>,
    pub created_at: String,
}

/// Tauri-managed handle to the SQLite database.
pub struct Db(Mutex<Connection>);

impl Db {
    /// Open (creating if needed) the database at `path` and ensure the schema exists.
    pub fn open(path: &Path) -> AppResult<Db> {
        let conn = Connection::open(path)?;
        conn.execute_batch(SCHEMA)?;
        migrate(&conn)?;
        Ok(Db(Mutex::new(conn)))
    }

    /// Insert a new session row and return its database id.
    pub fn create_session(
        &self,
        title: &str,
        language: &str,
        system_only: bool,
        started_at: &str,
    ) -> AppResult<i64> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO sessions (title, language, system_only, started_at) \
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![title, language, system_only, started_at],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// Set `ended_at` if the session produced any segments; otherwise delete the
    /// empty row so failed or instantly-stopped starts don't clutter the history.
    /// Returns `true` if the session was kept.
    pub fn finalize_session(&self, id: i64, ended_at: &str) -> AppResult<bool> {
        let conn = self.0.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM segments WHERE session_id = ?1",
            [id],
            |r| r.get(0),
        )?;
        if count == 0 {
            conn.execute("DELETE FROM sessions WHERE id = ?1", [id])?;
            Ok(false)
        } else {
            conn.execute(
                "UPDATE sessions SET ended_at = ?1 WHERE id = ?2",
                rusqlite::params![ended_at, id],
            )?;
            Ok(true)
        }
    }

    /// Persist a final transcript segment (idempotent on (session_id, segment_id)).
    pub fn upsert_segment(&self, seg: &TranscriptSegment) -> AppResult<()> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO segments \
               (session_id, segment_id, source, speaker, text, t_start, t_end, confidence) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) \
             ON CONFLICT(session_id, segment_id) DO UPDATE SET \
               text = excluded.text, speaker = excluded.speaker, \
               t_end = excluded.t_end, confidence = excluded.confidence",
            rusqlite::params![
                seg.session_id,
                seg.segment_id,
                seg.source,
                seg.speaker,
                seg.text,
                seg.t_start,
                seg.t_end,
                seg.confidence,
            ],
        )?;
        Ok(())
    }

    /// Store the live translation for a finalized segment (idempotent on
    /// (session_id, segment_id)). The matching row is created by `upsert_segment`
    /// before the frontend requests a translation, so this only updates columns.
    pub fn save_translation(
        &self,
        session_id: i64,
        segment_id: &str,
        translation: &str,
        lang: &str,
    ) -> AppResult<()> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "UPDATE segments SET translation = ?1, translation_lang = ?2 \
             WHERE session_id = ?3 AND segment_id = ?4",
            rusqlite::params![translation, lang, session_id, segment_id],
        )?;
        Ok(())
    }

    /// Existing translation for a segment as `(translation, lang)`, or `None`
    /// (also `None` when the row has no translation yet). Used to skip a second
    /// OpenAI call for an already-translated line.
    pub fn get_translation(
        &self,
        session_id: i64,
        segment_id: &str,
    ) -> AppResult<Option<(String, String)>> {
        let conn = self.0.lock().unwrap();
        let row = conn
            .query_row(
                "SELECT translation, translation_lang FROM segments \
                 WHERE session_id = ?1 AND segment_id = ?2",
                rusqlite::params![session_id, segment_id],
                |r| {
                    Ok((
                        r.get::<_, Option<String>>(0)?,
                        r.get::<_, Option<String>>(1)?,
                    ))
                },
            )
            .optional()?;
        Ok(match row {
            Some((Some(t), Some(l))) => Some((t, l)),
            _ => None,
        })
    }

    /// All sessions, newest first, each with its transcript segment count.
    pub fn list_sessions(&self) -> AppResult<Vec<SessionSummary>> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT s.id, s.title, s.language, s.system_only, s.started_at, s.ended_at, \
                    s.summary, s.summary_model, s.summarized_at, \
                    COUNT(seg.id) AS segment_count \
             FROM sessions s \
             LEFT JOIN segments seg ON seg.session_id = s.id \
             GROUP BY s.id \
             ORDER BY s.started_at DESC, s.id DESC",
        )?;
        let rows = stmt.query_map([], row_to_summary)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Full-text search across every transcript. Returns one hit per matching
    /// session, most-relevant first (FTS5 `bm25`), each carrying the highlighted
    /// snippet of its best-matching line and the count of matching lines. `query`
    /// is raw user input; an empty/operator-only query yields no hits.
    pub fn search_sessions(&self, query: &str) -> AppResult<Vec<SearchHit>> {
        let match_query = to_fts_query(query);
        if match_query.is_empty() {
            return Ok(Vec::new());
        }
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT seg.session_id, s.title, s.started_at, \
                    snippet(segments_fts, 0, '[', ']', '…', 12) \
             FROM segments_fts \
             JOIN segments seg ON seg.id = segments_fts.rowid \
             JOIN sessions s ON s.id = seg.session_id \
             WHERE segments_fts MATCH ?1 \
             ORDER BY bm25(segments_fts)",
        )?;
        let rows = stmt.query_map([match_query], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?;

        // Rows arrive best-match-first; the first time a session appears is its
        // top line (snippet kept), later rows of the same session just count.
        let mut order: Vec<i64> = Vec::new();
        let mut hits: HashMap<i64, SearchHit> = HashMap::new();
        for r in rows {
            let (session_id, title, started_at, snippet) = r?;
            if let Some(hit) = hits.get_mut(&session_id) {
                hit.match_count += 1;
            } else {
                order.push(session_id);
                hits.insert(
                    session_id,
                    SearchHit {
                        session_id,
                        title,
                        started_at,
                        snippet,
                        match_count: 1,
                    },
                );
            }
        }
        Ok(order
            .into_iter()
            .filter_map(|id| hits.remove(&id))
            .collect())
    }

    /// One session plus its full transcript (chronological), or `None` if missing.
    pub fn get_session(&self, id: i64) -> AppResult<Option<SessionDetail>> {
        let conn = self.0.lock().unwrap();
        let session = conn
            .query_row(
                "SELECT s.id, s.title, s.language, s.system_only, s.started_at, s.ended_at, \
                        s.summary, s.summary_model, s.summarized_at, \
                        COUNT(seg.id) AS segment_count \
                 FROM sessions s \
                 LEFT JOIN segments seg ON seg.session_id = s.id \
                 WHERE s.id = ?1 \
                 GROUP BY s.id",
                [id],
                row_to_summary,
            )
            .optional()?;

        let Some(session) = session else {
            return Ok(None);
        };

        let mut stmt = conn.prepare(
            "SELECT segment_id, source, speaker, text, t_start, t_end, confidence, translation, translation_lang \
             FROM segments WHERE session_id = ?1 ORDER BY t_start, id",
        )?;
        let rows = stmt.query_map([id], |row| {
            Ok(StoredSegment {
                segment_id: row.get(0)?,
                source: row.get(1)?,
                speaker: row.get(2)?,
                text: row.get(3)?,
                t_start: row.get(4)?,
                t_end: row.get(5)?,
                confidence: row.get(6)?,
                translation: row.get(7)?,
                translation_lang: row.get(8)?,
            })
        })?;
        let mut segments = Vec::new();
        for r in rows {
            segments.push(r?);
        }

        Ok(Some(SessionDetail { session, segments }))
    }

    /// Delete a session and its segments (cascades via the foreign key).
    pub fn delete_session(&self, id: i64) -> AppResult<()> {
        let conn = self.0.lock().unwrap();
        conn.execute("DELETE FROM sessions WHERE id = ?1", [id])?;
        Ok(())
    }

    /// Rename a session.
    pub fn rename_session(&self, id: i64, title: &str) -> AppResult<()> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "UPDATE sessions SET title = ?1 WHERE id = ?2",
            rusqlite::params![title, id],
        )?;
        Ok(())
    }

    /// Rename a speaker label across one session's transcript. `from` is the
    /// stored `speaker` value to match (`None` matches the un-diarized `NULL`
    /// group); every matching row's label becomes `to`. `source` is never
    /// touched, so the mic/remote icon and the reserved "You" colour are kept.
    /// Returns the number of rows changed.
    pub fn rename_speaker(
        &self,
        session_id: i64,
        from: Option<&str>,
        to: &str,
    ) -> AppResult<usize> {
        let conn = self.0.lock().unwrap();
        let changed = conn.execute(
            "UPDATE segments SET speaker = ?1 WHERE session_id = ?2 AND speaker IS ?3",
            rusqlite::params![to, session_id, from],
        )?;
        Ok(changed)
    }

    /// Store (or replace) the AI-generated summary for a session (Milestone E).
    pub fn save_summary(&self, id: i64, summary: &str, model: &str, at: &str) -> AppResult<()> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "UPDATE sessions SET summary = ?1, summary_model = ?2, summarized_at = ?3 \
             WHERE id = ?4",
            rusqlite::params![summary, model, at, id],
        )?;
        Ok(())
    }

    /// Read a value from the key-value `app_settings` table, or `None` if unset.
    /// Used for app-wide preferences that must outlive a single launch (e.g. the
    /// AI summary output language).
    pub fn get_setting(&self, key: &str) -> AppResult<Option<String>> {
        let conn = self.0.lock().unwrap();
        let value = conn
            .query_row(
                "SELECT value FROM app_settings WHERE key = ?1",
                [key],
                |r| r.get::<_, String>(0),
            )
            .optional()?;
        Ok(value)
    }

    /// Insert or replace a key-value `app_settings` row.
    pub fn set_setting(&self, key: &str, value: &str) -> AppResult<()> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES (?1, ?2) \
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params![key, value],
        )?;
        Ok(())
    }

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

/// Add columns introduced after the first release to pre-existing databases.
/// Fresh databases already have them via `SCHEMA`; this keeps older `sososo.db`
/// files in sync (SQLite has no `ADD COLUMN IF NOT EXISTS`).
fn migrate(conn: &Connection) -> AppResult<()> {
    let existing = table_columns(conn, "sessions")?;
    for (name, ddl) in [
        ("summary", "ALTER TABLE sessions ADD COLUMN summary TEXT"),
        (
            "summary_model",
            "ALTER TABLE sessions ADD COLUMN summary_model TEXT",
        ),
        (
            "summarized_at",
            "ALTER TABLE sessions ADD COLUMN summarized_at TEXT",
        ),
    ] {
        if !existing.iter().any(|c| c == name) {
            conn.execute(ddl, [])?;
        }
    }

    let seg_existing = table_columns(conn, "segments")?;
    for (name, ddl) in [
        (
            "translation",
            "ALTER TABLE segments ADD COLUMN translation TEXT",
        ),
        (
            "translation_lang",
            "ALTER TABLE segments ADD COLUMN translation_lang TEXT",
        ),
    ] {
        if !seg_existing.iter().any(|c| c == name) {
            conn.execute(ddl, [])?;
        }
    }

    // Build the FTS index for databases that predate it. `count(*)` on an
    // external-content FTS5 table reflects the *content* table (`segments`), not
    // the inverted index, so it can't tell us whether the index is populated —
    // gate the one-time `rebuild` (which rebuilds the index from `segments`) on a
    // settings flag instead. Afterwards the triggers keep the index in sync, so
    // this never re-runs unless the flag is cleared.
    let fts_built: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'fts_built'",
            [],
            |r| r.get(0),
        )
        .optional()?;
    if fts_built.is_none() {
        conn.execute(
            "INSERT INTO segments_fts(segments_fts) VALUES ('rebuild')",
            [],
        )?;
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES ('fts_built', '1') \
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [],
        )?;
    }
    Ok(())
}

/// Column names of `table` via `PRAGMA table_info`.
fn table_columns(conn: &Connection, table: &str) -> AppResult<Vec<String>> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(1))?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

fn row_to_summary(row: &rusqlite::Row<'_>) -> rusqlite::Result<SessionSummary> {
    Ok(SessionSummary {
        id: row.get(0)?,
        title: row.get(1)?,
        language: row.get(2)?,
        system_only: row.get(3)?,
        started_at: row.get(4)?,
        ended_at: row.get(5)?,
        summary: row.get(6)?,
        summary_model: row.get(7)?,
        summarized_at: row.get(8)?,
        segment_count: row.get(9)?,
    })
}

/// Turn raw user input into a safe FTS5 MATCH expression: each whitespace token
/// (with embedded quotes stripped, kept only if it has an alphanumeric char)
/// becomes a quoted prefix term `"foo"*`, joined by spaces (implicit AND).
/// Quoting stops punctuation/operators from triggering FTS5 syntax errors; the
/// trailing `*` makes search-as-you-type match prefixes. Empty input → "".
fn to_fts_query(input: &str) -> String {
    input
        .split_whitespace()
        .map(|t| t.replace('"', ""))
        .filter(|t| t.chars().any(char::is_alphanumeric))
        .map(|t| format!("\"{t}\"*"))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::TranscriptSegment;

    /// A fresh in-memory database wired through the real SCHEMA + migrate(), so
    /// tests exercise the same setup as production without touching disk.
    fn mem_db() -> Db {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        migrate(&conn).unwrap();
        Db(Mutex::new(conn))
    }

    fn seg(session_id: i64, segment_id: &str, source: &str, text: &str) -> TranscriptSegment {
        TranscriptSegment {
            session_id,
            segment_id: segment_id.into(),
            source: source.into(),
            speaker: None,
            text: text.into(),
            t_start: 0.0,
            t_end: None,
            is_final: true,
            confidence: None,
        }
    }

    #[test]
    fn create_then_finalize_keeps_a_session_that_has_segments() {
        let db = mem_db();
        let id = db
            .create_session("Meeting", "en", false, "2026-01-01T00:00:00Z")
            .unwrap();
        db.upsert_segment(&seg(id, "a", "you", "hello")).unwrap();
        let kept = db.finalize_session(id, "2026-01-01T00:10:00Z").unwrap();
        assert!(kept);
        let detail = db.get_session(id).unwrap().expect("session present");
        assert_eq!(
            detail.session.ended_at.as_deref(),
            Some("2026-01-01T00:10:00Z")
        );
        assert_eq!(detail.segments.len(), 1);
        assert_eq!(detail.segments[0].text, "hello");
    }

    #[test]
    fn finalize_deletes_a_session_with_no_segments() {
        let db = mem_db();
        let id = db
            .create_session("Empty", "en", false, "2026-01-01T00:00:00Z")
            .unwrap();
        let kept = db.finalize_session(id, "2026-01-01T00:00:01Z").unwrap();
        assert!(!kept);
        assert!(db.get_session(id).unwrap().is_none());
    }

    #[test]
    fn upsert_segment_is_idempotent_on_segment_id() {
        let db = mem_db();
        let id = db.create_session("S", "en", false, "t").unwrap();
        db.upsert_segment(&seg(id, "x", "you", "interim")).unwrap();
        db.upsert_segment(&seg(id, "x", "you", "final")).unwrap();
        let detail = db.get_session(id).unwrap().unwrap();
        assert_eq!(detail.segments.len(), 1);
        assert_eq!(detail.segments[0].text, "final");
    }

    #[test]
    fn list_sessions_returns_newest_first_with_segment_counts() {
        let db = mem_db();
        let a = db
            .create_session("A", "en", false, "2026-01-01T00:00:00Z")
            .unwrap();
        let b = db
            .create_session("B", "en", false, "2026-01-02T00:00:00Z")
            .unwrap();
        db.upsert_segment(&seg(a, "a1", "you", "hi")).unwrap();
        db.upsert_segment(&seg(b, "b1", "you", "hi")).unwrap();
        db.upsert_segment(&seg(b, "b2", "remote", "yo")).unwrap();
        let list = db.list_sessions().unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].title, "B"); // newer started_at first
        assert_eq!(list[0].segment_count, 2);
        assert_eq!(list[1].segment_count, 1);
    }

    #[test]
    fn translation_round_trips_and_is_absent_by_default() {
        let db = mem_db();
        let id = db.create_session("S", "en", false, "t").unwrap();
        db.upsert_segment(&seg(id, "x", "you", "hello")).unwrap();
        assert_eq!(db.get_translation(id, "x").unwrap(), None);
        db.save_translation(id, "x", "halo", "id").unwrap();
        assert_eq!(
            db.get_translation(id, "x").unwrap(),
            Some(("halo".into(), "id".into()))
        );
    }

    #[test]
    fn rename_speaker_matches_a_label_and_the_null_group() {
        let db = mem_db();
        let id = db.create_session("S", "en", false, "t").unwrap();
        let mut diarized = seg(id, "x", "remote", "a");
        diarized.speaker = Some("1".into());
        db.upsert_segment(&diarized).unwrap();
        db.upsert_segment(&seg(id, "y", "remote", "b")).unwrap(); // NULL speaker

        assert_eq!(db.rename_speaker(id, Some("1"), "Alice").unwrap(), 1);
        assert_eq!(db.rename_speaker(id, None, "Bob").unwrap(), 1);

        let detail = db.get_session(id).unwrap().unwrap();
        let speakers: Vec<_> = detail.segments.iter().map(|s| s.speaker.clone()).collect();
        assert!(speakers.contains(&Some("Alice".into())));
        assert!(speakers.contains(&Some("Bob".into())));
    }

    #[test]
    fn settings_round_trip_and_overwrite() {
        let db = mem_db();
        assert_eq!(db.get_setting("k").unwrap(), None);
        db.set_setting("k", "v1").unwrap();
        assert_eq!(db.get_setting("k").unwrap(), Some("v1".into()));
        db.set_setting("k", "v2").unwrap();
        assert_eq!(db.get_setting("k").unwrap(), Some("v2".into()));
    }

    #[test]
    fn chat_messages_append_in_order_and_clear() {
        let db = mem_db();
        let id = db.create_session("S", "en", false, "t").unwrap();
        db.add_chat_message(id, "user", "hi", None, "t1").unwrap();
        db.add_chat_message(id, "assistant", "hello", Some("gpt-4o-mini"), "t2")
            .unwrap();
        let msgs = db.get_chat_messages(id).unwrap();
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0].role, "user");
        assert_eq!(msgs[1].model.as_deref(), Some("gpt-4o-mini"));
        db.clear_chat_messages(id).unwrap();
        assert!(db.get_chat_messages(id).unwrap().is_empty());
    }

    #[test]
    fn search_finds_matching_lines_and_skips_empty_queries() {
        let db = mem_db();
        let id = db
            .create_session("Talk", "en", false, "2026-01-01T00:00:00Z")
            .unwrap();
        db.upsert_segment(&seg(id, "a", "you", "the quick brown fox"))
            .unwrap();
        db.upsert_segment(&seg(id, "b", "remote", "lazy dog sleeps"))
            .unwrap();

        assert!(db.search_sessions("   ").unwrap().is_empty());

        let hits = db.search_sessions("quick").unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].session_id, id);
        assert!(hits[0].snippet.contains('[')); // matched term is wrapped
    }

    #[test]
    fn search_counts_multiple_matching_lines_per_session() {
        let db = mem_db();
        let id = db.create_session("Talk", "en", false, "t").unwrap();
        db.upsert_segment(&seg(id, "a", "you", "alpha beta"))
            .unwrap();
        db.upsert_segment(&seg(id, "b", "remote", "alpha gamma"))
            .unwrap();
        let hits = db.search_sessions("alpha").unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].match_count, 2);
    }

    #[test]
    fn to_fts_query_quotes_prefix_terms_and_drops_punctuation() {
        assert_eq!(to_fts_query("foo bar"), "\"foo\"* \"bar\"*");
        assert_eq!(to_fts_query("  hello   world  "), "\"hello\"* \"world\"*");
        assert_eq!(to_fts_query("\"quoted\""), "\"quoted\"*");
        assert_eq!(to_fts_query("--- !!!"), "");
        assert_eq!(to_fts_query(""), "");
    }
}
