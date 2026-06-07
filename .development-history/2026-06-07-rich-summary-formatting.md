# Feature: Rich Markdown formatting for AI summary

**Goal:** Make the AI Summary read as a tidy, formatted document — clear section
headings, bullet **and** numbered lists, **bold** for key terms, _italic_, and inline
`code` — instead of the previous flat text.

## Key changes

- `src/windows/main/routes/SessionDetailRoute.tsx`: replaced `SummaryView` + the
  `stripInline` helper (which _removed_ `**bold**`/`` `code` ``) with a richer custom
  renderer.
  - New `renderInline()` returns `ReactNode[]`, parsing `**bold**`, `*italic*` / `_italic_`,
    and `` `code` `` (styled chip) via a single ordered-alternation regex.
  - `SummaryView` now distinguishes heading levels (H1–H2 → accent uppercase section
    label matching the "AI SUMMARY" style; H3+ → sub-heading), and a generalized
    list collector handles both `ul` (`-`/`*`) and `ol` (`1.`) with proper flush-on-switch.
- `src-tauri/src/ai.rs`: enriched the prompt so the model actually emits that formatting.
  - `SYSTEM_PROMPT`: "well-structured prose" → "well-structured **Markdown** summary
    (headings, bullet/numbered lists, **bold** for key terms)".
  - `user_prompt`: instructs **bold** on key terms/names/decisions/dates/numbers and
    _italic_ for nuance; Action Items are now a numbered list. Applies to OpenAI **and**
    Gemini (both go through `summarize()` → `chat()`).

## Decisions

- **No new dependency** — kept the custom parser (project is deliberately minimal-dep;
  Tailwind v4 has no `typography` plugin). The AI emits a controlled Markdown subset, so
  a full library (react-markdown) was unnecessary.
- **Links `[t](url)` out of scope** — rare in transcripts; avoids opener-permission work.
- Backward-compatible: old summaries (headings + bullets) still render correctly.

## Verification

- `bun run build` (tsc strict + vite) — passes; `stripInline` removed, `renderInline` used.
- `cargo check` (from `src-tauri/`) — prompt string still compiles clean.
- Manual: `tauri dev` → session detail → **Regenerate** → bold/italic/code, bullet +
  numbered lists, and accent section headings render in the liquid-glass panel.

## Coordination (multi-agent)

- The renderer hunk lives in `SessionDetailRoute.tsx`, which a concurrent agent was
  simultaneously editing for a transcript-translate feature (coupled to `db.rs` +
  `domain.ts` via a new required `StoredSegment.segmentId`). To avoid bundling another
  agent's scope, only the self-contained prompt change (`ai.rs`) + this note were
  committed separately; the renderer ships with the shared file alongside that feature.
