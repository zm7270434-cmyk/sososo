# Edit Speaker Names (session history)

**Goal:** Rename diarized speaker labels ("Speaker 1" → real name) in a saved session.

**Changes:**

- `db.rs` `rename_speaker(session_id, from, to)` — `UPDATE segments SET speaker = ? WHERE session_id = ? AND speaker IS ?` (`IS` matches the NULL/un-diarized group). Returns rows changed.
- `commands.rs` `rename_speaker` command (trims, rejects empty `to`); registered in `lib.rs`.
- `lib/ipc.ts` `renameSpeaker(sessionId, from, to)`.
- `SessionDetailRoute.tsx` — "Speakers" panel above the transcript: one chip per distinct speaker (colour dot + name + line count + pencil). Inline edit (Enter/Esc/blur) → `renameSpeaker` + optimistic `segments` update.

**Decisions:**

- History only (live `RecordingView` untouched). Overwrite in place (no mapping table / reset). Rename is session-wide per label. "You" + the un-diarized group are renamable; `source` never changes so the mic/remote icon and the reserved "You" colour persist.

**Verification:** `cargo check` ✓ (backend code clippy-clean — the 2 pre-existing `manual_repeat_n` clippy lints are in `audio/mixer.rs`, out of this scope). `bun run build` (tsc strict + vite) ✓.

**Docs:** spec `docs/superpowers/specs/2026-06-06-edit-speaker-names-design.md`, plan `docs/superpowers/plans/2026-06-06-edit-speaker-names.md`.
