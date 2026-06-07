import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { searchSessions } from '../../../lib/ipc';
import { formatDateTime } from '../../../lib/format';
import { IconInbox, IconSearch } from '../../../lib/icons';
import type { SearchHit } from '../../../types/domain';

/** Full-text search across every saved transcript. The backend (FTS5) returns one
 *  hit per matching session with a highlighted snippet; clicking opens the
 *  session. An in-transcript find (Ctrl/Cmd+F) lives in the session detail view. */
export default function SearchRoute() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<'idle' | 'searching' | 'done'>('idle');

  // Debounced search-as-you-type. The stale-timeout cleanup keeps results in
  // step with the latest query.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      setStatus('idle');
      return;
    }
    setStatus('searching');
    const t = setTimeout(() => {
      searchSessions(q)
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setStatus('done'));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="mx-auto max-w-[760px] px-7 py-6">
      <h2 className="mb-4 inline-flex items-center gap-2 text-[20px] font-semibold text-fg">
        <HugeiconsIcon icon={IconSearch} size={20} strokeWidth={1.8} aria-hidden={true} />
        Search transcripts
      </h2>
      <input
        type="text"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search across every transcript…"
        className="w-full rounded-sm border border-[rgba(255,192,77,0.6)] bg-[rgba(255,192,77,0.08)] px-3.5 py-2.5 text-[14px] text-fg caret-[#ffc04d] outline-none placeholder:text-fg-faint focus:border-[#ffc04d]"
      />

      <div className="mt-4 flex flex-col gap-2">
        {hits.length > 0 ? (
          hits.map((h) => (
            <button
              key={h.sessionId}
              onClick={() => navigate(`/main/session/${h.sessionId}`)}
              className="flex cursor-pointer flex-col gap-1 rounded-md border border-glass-border bg-[rgba(255,255,255,0.04)] px-4 py-3 text-left transition-colors duration-[120ms] hover:bg-hover"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[14px] font-medium text-fg">{h.title}</span>
                <span className="shrink-0 text-[11px] text-fg-faint">
                  {h.matchCount} {h.matchCount === 1 ? 'match' : 'matches'}
                </span>
              </span>
              <span className="text-[11px] text-fg-faint">{formatDateTime(h.startedAt)}</span>
              <span className="mt-0.5 text-[13px] leading-[1.5] text-fg-dim">
                {renderSnippet(h.snippet)}
              </span>
            </button>
          ))
        ) : status === 'searching' ? (
          <p className="px-1 text-[13px] text-fg-faint">Searching…</p>
        ) : status === 'done' ? (
          <div className="flex flex-col items-center gap-2 py-10 text-fg-faint">
            <HugeiconsIcon icon={IconInbox} size={28} strokeWidth={1.5} aria-hidden={true} />
            <p className="text-[13px]">No matches for "{query.trim()}".</p>
          </div>
        ) : (
          <p className="px-1 text-[13px] text-fg-faint">
            Type to search across every saved transcript.
          </p>
        )}
      </div>
    </div>
  );
}

/** Render an FTS5 snippet, wrapping the `[`…`]`-marked match terms in a highlight. */
function renderSnippet(snippet: string): ReactNode {
  const out: ReactNode[] = [];
  const re = /\[([^\]]*)\]/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(snippet)) !== null) {
    if (m.index > last) out.push(snippet.slice(last, m.index));
    out.push(
      <mark className="rounded-[3px] bg-[rgba(110,168,254,0.32)] px-0.5 text-fg" key={key++}>
        {m[1]}
      </mark>,
    );
    last = re.lastIndex;
  }
  if (last < snippet.length) out.push(snippet.slice(last));
  return out;
}
