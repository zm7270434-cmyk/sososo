import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { IconAlert, IconChat, IconChevronRight, IconDelete, IconSend } from '../../../../lib/icons';
import {
  chatSession,
  clearChat,
  getAiProvider,
  getChatMessages,
  hasApiKey,
} from '../../../../lib/ipc';
import { useConfigStore } from '../../../../state/configStore';
import { ChatBubble } from './markdown';
import type { ChatMessage } from '../../../../types/domain';

/**
 * Right sidebar card on the session-detail page: "ask about this transcript"
 * via the active AI provider. Self-contained — owns its persisted per-session
 * history, draft, in-flight flag, the provider-key gate, a chat error, and the
 * auto-scroll-to-newest behavior. Re-keyed by `sessionId`. Collapses into a thin
 * vertical "Ask" strip via the persisted `chatCollapsed` config flag.
 */
export default function ChatPanel({ sessionId }: { sessionId: number }) {
  const collapsed = useConfigStore((s) => s.chatCollapsed);
  const setCollapsed = useConfigStore((s) => s.setChatCollapsed);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  // Whether the active AI provider's key is set (gates the input).
  const [aiReady, setAiReady] = useState(false);
  const [err, setErr] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load saved history and resolve the provider-key gate on mount. The parent
  // remounts this panel via `key={sessionId}`, so per-session reset is automatic.
  useEffect(() => {
    let alive = true;
    getChatMessages(sessionId)
      .then((msgs) => {
        if (alive) setMessages(msgs);
      })
      .catch(() => {});
    void (async () => {
      try {
        const ready = await hasApiKey(await getAiProvider());
        if (alive) setAiReady(ready);
      } catch {
        if (alive) setAiReady(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId]);

  // Keep pinned to the newest message as it grows / while thinking.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // Send a chat question about this transcript. Optimistically shows the user's
  // message, then swaps the placeholder for the two persisted turns the backend
  // returns (`[user, assistant]`). On failure the draft text is restored.
  async function send() {
    const q = input.trim();
    if (!q || sending || !aiReady) return;
    setErr('');
    setInput('');
    setSending(true);
    const tempId = -Date.now();
    setMessages((m) => [...m, { id: tempId, role: 'user', content: q, createdAt: '' }]);
    try {
      const added = await chatSession(sessionId, q);
      setMessages((m) => [...m.filter((x) => x.id !== tempId), ...added]);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setInput(q);
      setErr(String(e));
    } finally {
      setSending(false);
    }
  }

  async function clearHistory() {
    try {
      await clearChat(sessionId);
      setMessages([]);
      setErr('');
    } catch (e) {
      setErr(String(e));
    }
  }

  // Collapsed: a thin vertical strip with a chat icon + rotated "Ask" label;
  // clicking anywhere on it re-expands the panel.
  if (collapsed) {
    return (
      <aside className="liquid-glass flex w-11 shrink-0 flex-col overflow-hidden rounded-lg">
        <button
          onClick={() => setCollapsed(false)}
          title="Expand transcript chat"
          aria-label="Expand transcript chat"
          className="flex h-full w-full cursor-pointer flex-col items-center gap-3 py-4 text-fg-faint transition-colors hover:bg-hover hover:text-fg"
        >
          <HugeiconsIcon icon={IconChat} size={17} strokeWidth={1.8} aria-hidden={true} />
          <span className="text-[12px] font-semibold tracking-[0.18em] text-accent-2 uppercase [writing-mode:vertical-rl]">
            Ask
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="liquid-glass flex w-[320px] shrink-0 flex-col overflow-hidden rounded-lg">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-glass-border px-3 py-3">
        <h3 className="m-0 inline-flex min-w-0 items-center gap-1.5 text-[12px] tracking-[0.06em] text-accent-2 uppercase">
          <HugeiconsIcon
            icon={IconChat}
            size={14}
            strokeWidth={1.8}
            className="shrink-0"
            aria-hidden={true}
          />
          <span className="truncate">Ask about this transcript</span>
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          {aiReady && messages.length > 0 && (
            <button
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.06)] px-2 py-1 text-[11.5px] text-fg-faint shadow-liquid hover:bg-hover hover:text-fg-dim"
              onClick={() => void clearHistory()}
              title="Clear chat history"
            >
              <HugeiconsIcon icon={IconDelete} size={12} strokeWidth={1.8} aria-hidden={true} />
              Clear
            </button>
          )}
          <button
            className="inline-flex shrink-0 cursor-pointer items-center rounded-sm p-1 text-fg-faint hover:bg-hover hover:text-fg"
            onClick={() => setCollapsed(true)}
            title="Collapse chat"
            aria-label="Collapse transcript chat"
          >
            <HugeiconsIcon icon={IconChevronRight} size={16} strokeWidth={1.8} aria-hidden={true} />
          </button>
        </div>
      </div>

      {!aiReady ? (
        <div className="flex flex-1 items-center px-4">
          <p className="text-[13px] leading-[1.5] text-fg-dim">
            Set an OpenAI or Gemini API key in{' '}
            <Link to="/main/settings" className="text-accent-2 underline">
              Settings
            </Link>{' '}
            to chat about this transcript.
          </p>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3.5"
          >
            {messages.length === 0 && !sending ? (
              <p className="text-[13px] leading-[1.5] text-fg-dim">
                Ask anything about this transcript — e.g. “What were the main decisions?” or “What
                did each speaker focus on?”
              </p>
            ) : (
              <>
                {messages.map((m) => (
                  <ChatBubble key={m.id} msg={m} />
                ))}
                {sending && (
                  <div className="max-w-[85%] self-start rounded-lg rounded-bl-sm border border-glass-border bg-[rgba(255,255,255,0.06)] px-3 py-2 text-[13px] text-fg-faint italic">
                    Thinking…
                  </div>
                )}
              </>
            )}
          </div>
          <div className="shrink-0 border-t border-glass-border px-3 py-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder="Ask about this transcript…"
                disabled={sending}
                className="max-h-[120px] min-h-[38px] flex-1 resize-y rounded-sm border border-glass-border bg-[rgba(255,255,255,0.06)] px-3 py-2 text-[13px] leading-[1.5] text-fg caret-[#b794f6] outline-none placeholder:text-fg-faint focus:border-accent-2 disabled:opacity-60"
              />
              <button
                className="inline-flex h-[38px] shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-[rgba(167,139,250,0.5)] bg-[rgba(167,139,250,0.16)] px-3.5 text-[13px] font-medium whitespace-nowrap text-[#d6c6ff] shadow-liquid enabled:hover:bg-[rgba(167,139,250,0.26)] disabled:cursor-default disabled:opacity-50"
                onClick={() => void send()}
                disabled={sending || !input.trim()}
              >
                <HugeiconsIcon icon={IconSend} size={15} strokeWidth={1.8} aria-hidden={true} />
                Send
              </button>
            </div>
            {err && (
              <p className="mt-2.5 flex items-start gap-2 rounded-sm border border-[rgba(255,180,84,0.25)] bg-[rgba(255,180,84,0.1)] px-3 py-2 text-[12.5px] text-[#ffb454]">
                <HugeiconsIcon
                  icon={IconAlert}
                  size={15}
                  strokeWidth={1.8}
                  className="mt-px shrink-0"
                  aria-hidden={true}
                />
                <span>{err}</span>
              </p>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
