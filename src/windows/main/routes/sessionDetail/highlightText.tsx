import type { ReactNode } from 'react';

/** Wrap case-insensitive occurrences of `query` within `text` in a highlight mark. */
export function highlightText(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const lq = q.toLowerCase();
  let idx = lower.indexOf(lq);
  if (idx === -1) return text;
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (idx !== -1) {
    if (idx > i) out.push(text.slice(i, idx));
    out.push(
      <mark className="rounded-[2px] bg-[rgba(255,213,79,0.45)] text-fg" key={key++}>
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
    idx = lower.indexOf(lq, i);
  }
  if (i < text.length) out.push(text.slice(i));
  return out;
}
