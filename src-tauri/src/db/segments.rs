//! Transcript-segment writes: persist, translate, rename speakers.

use rusqlite::OptionalExtension;

use crate::error::AppResult;
use crate::events::TranscriptSegment;

use super::Db;

impl Db {
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
}
