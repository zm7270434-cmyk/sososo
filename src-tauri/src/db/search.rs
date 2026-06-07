//! Full-text transcript search (FTS5).

use std::collections::HashMap;

use crate::error::AppResult;

use super::{Db, SearchHit};

impl Db {
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
    use super::to_fts_query;

    #[test]
    fn to_fts_query_quotes_prefix_terms_and_drops_punctuation() {
        assert_eq!(to_fts_query("foo bar"), "\"foo\"* \"bar\"*");
        assert_eq!(to_fts_query("  hello   world  "), "\"hello\"* \"world\"*");
        assert_eq!(to_fts_query("\"quoted\""), "\"quoted\"*");
        assert_eq!(to_fts_query("--- !!!"), "");
        assert_eq!(to_fts_query(""), "");
    }
}
