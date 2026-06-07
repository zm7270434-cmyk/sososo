# Transcript chat → right sidebar (session detail)

**Goal:** Move the per-session "Ask about this transcript" chat out of the inline
collapsible mid-page section into an always-visible right sidebar on the
session-detail (transcription result) page.

## Key changes

- **New `routes/sessionDetail/ChatPanel.tsx`** — self-contained right sidebar.
  Owns all chat state (history, draft, in-flight, provider-key gate, error) and
  IPC (`getChatMessages`, `chatSession`, `clearChat`, `getAiProvider`,
  `hasApiKey`) + auto-scroll-to-newest. No open/close toggle (always visible).
  Layout: full-height `flex-col` — header (title + Clear) / scrollable messages /
  pinned input. Left-border divider + faint accent-2 (purple) tint.
- **`SessionDetailRoute.tsx`** — restructured root into a 2-column split:
  `flex h-full` → left scroll column (`flex-1 overflow-y-auto`, content centered
  `max-w-[760px]`) + `<ChatPanel>` (`w-[340px] shrink-0`) on the right. Chat
  sidebar renders only when `segments.length > 0`.
- Removed the old inline chat `<section>`, all chat state/effects/handlers
  (`sendChat`, `clearChatHistory`, auto-scroll effect, loader chat-resets) and
  now-unused imports (`IconChat`, `IconChevronDown`, `IconSend`, `chatSession`,
  `clearChat`, `getChatMessages`, `ChatBubble`, `ChatMessage`).

## Decisions

- **Always-visible split** (user choice) over a toggle drawer / collapsible dock.
- **`key={sessionId}`** on `<ChatPanel>` → React remounts it per session, so
  per-session state reset is automatic (avoids synchronous setState-in-effect).
- Behavior of chat logic itself is unchanged — pure UI relocation + component
  extraction (also trims the 960-line route file).

## Verification

- `bun run build` (tsc strict + vite) — clean.
- `bun test` — 33 pass / 0 fail.
- `eslint` — 0 errors (ChatPanel clean; pre-existing route warnings untouched).
