# Transcript chat → right sidebar column (session detail)

**Goal:** Move the per-session "Ask about this transcript" chat out of the inline
collapsible mid-page section into a dedicated right sidebar that shows on the
session-detail (transcription result) page — a third top-level glass card sitting
beside the left `SessionSidebar` and the main content, so the shell reads as
three side-by-side cards: **sidebar · content · chat**.

## Key changes

- **New `routes/sessionDetail/ChatPanel.tsx`** — self-contained sidebar card
  (`liquid-glass w-[320px] shrink-0 rounded-lg overflow-hidden`, full-height
  `flex-col` — header / scrollable messages / pinned input with `border-b`/
  `border-t` dividers). Owns all chat state (history, draft, in-flight,
  provider-key gate, error), IPC (`getChatMessages`, `chatSession`, `clearChat`,
  `getAiProvider`, `hasApiKey`), and auto-scroll-to-newest. No open/close toggle.
- **`MainApp.tsx`** — renders the chat as the **third shell column**, a sibling of
  `<SessionSidebar>` and `<main>` inside the existing `flex gap-2` row. Detects
  the page with `useMatch('/main/session/:id')` and renders
  `<ChatPanel key={id} sessionId={id} />` only there; other routes stay
  two-column. Keying by id remounts it per session (automatic state reset).
- **`SessionDetailRoute.tsx`** — root reverted to the original centered content
  column (`mx-auto max-w-[760px]`); the chat no longer lives inside the route.
  Header rows (title + Rename/Delete, AI-summary controls, transcript controls)
  kept as `flex-wrap` with the title at `min-w-[12rem] flex-1` so actions wrap
  gracefully when the middle card is narrow.
- Removed the old inline chat `<section>`, its state/effects/handlers
  (`sendChat`, `clearChatHistory`, the chat auto-scroll effect, loader
  chat-resets) and now-unused imports (`IconChat`, `IconChevronDown`, `IconSend`,
  `chatSession`, `clearChat`, `getChatMessages`, `ChatBubble`, `ChatMessage`).

## Decisions

- **Third shell column** (user wireframe — three side-by-side cards) rather than a
  panel floating over / docked flush inside the main content. An earlier
  always-visible-split and a floating-absolute-overlay attempt were both wrong:
  the overlay cramped the content column and overflowed the section headers.
- Route-matched in `MainApp` (not rendered inside the route) so it is a genuine
  sibling card that shrinks `<main>` via flex, never overlapping it.
- Chat logic itself is unchanged — pure UI relocation + component extraction
  (also trims the 960-line route file).

## Verification

- `bun run build` (tsc strict + vite) — clean.
- `bun test` — 33 pass / 0 fail.
- `eslint` — 0 errors (changed files clean; pre-existing route warnings untouched).
