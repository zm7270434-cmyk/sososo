//! Key-value `app_settings` table for app-wide preferences.

use rusqlite::OptionalExtension;

use crate::error::AppResult;

use super::Db;

impl Db {
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
}
