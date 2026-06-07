import type { ReactNode } from 'react';

import type { ChatMessage } from '../../../../types/domain';

/** Render inline Markdown emphasis: **bold**, *italic* / _italic_, `code`. */
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Alternation order matters: `code` first, then **bold**, then *italic* / _italic_.
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) {
      out.push(
        <code
          className="rounded-[5px] border border-glass-border bg-[rgba(255,255,255,0.08)] px-1 py-0.5 font-mono text-[12.5px] text-fg"
          key={key++}
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith('**')) {
      out.push(
        <strong className="font-semibold text-fg" key={key++}>
          {tok.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(
        <em className="text-fg italic" key={key++}>
          {tok.slice(1, -1)}
        </em>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Minimal Markdown renderer for the summary: headings (section + sub), bullet &
 * numbered lists, paragraphs, and inline emphasis (**bold**, *italic*, `code`).
 * The AI emits a controlled Markdown subset, so a full parser library is overkill.
 */
export function SummaryView({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = (key: string) => {
    if (!listType || listItems.length === 0) {
      listItems = [];
      listType = null;
      return;
    }
    const type = listType;
    const li = listItems.map((it, i) => (
      <li className="pl-0.5 text-[13.5px] leading-[1.55] text-fg" key={i}>
        {renderInline(it)}
      </li>
    ));
    listItems = [];
    listType = null;
    nodes.push(
      type === 'ol' ? (
        <ol
          className="m-0 flex list-decimal flex-col gap-1 pl-[22px] marker:font-medium marker:text-fg-dim"
          key={key}
        >
          {li}
        </ol>
      ) : (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-[20px] marker:text-fg-faint" key={key}>
          {li}
        </ul>
      ),
    );
  };

  text.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (!t) {
      flushList(`l${i}`);
      return;
    }
    const heading = t.match(/^(#{1,6})\s+(.*)$/);
    const ordered = t.match(/^\d+\.\s+(.*)$/);
    const bullet = t.match(/^[-*]\s+(.*)$/);
    if (heading) {
      flushList(`l${i}`);
      const content = renderInline(heading[2]);
      nodes.push(
        heading[1].length <= 2 ? (
          <h4
            className="mt-3.5 mb-1 text-[12px] font-semibold tracking-[0.07em] text-accent uppercase first:mt-0"
            key={i}
          >
            {content}
          </h4>
        ) : (
          <h5 className="mt-2 mb-0.5 text-[13px] font-semibold text-fg first:mt-0" key={i}>
            {content}
          </h5>
        ),
      );
    } else if (ordered) {
      if (listType && listType !== 'ol') flushList(`l${i}`);
      listType = 'ol';
      listItems.push(ordered[1]);
    } else if (bullet) {
      if (listType && listType !== 'ul') flushList(`l${i}`);
      listType = 'ul';
      listItems.push(bullet[1]);
    } else {
      flushList(`l${i}`);
      nodes.push(
        <p className="m-0 text-[13.5px] leading-[1.6] text-fg" key={i}>
          {renderInline(t)}
        </p>,
      );
    }
  });
  flushList('lend');

  return <div className="flex flex-col gap-1.5">{nodes}</div>;
}

/** One chat turn: the user's question (right, blue) shown as plain text, or the
 *  assistant's reply (left, neutral) rendered through the shared Markdown view. */
export function ChatBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'user') {
    return (
      <div className="max-w-[85%] self-end rounded-lg rounded-br-sm border border-[rgba(110,168,254,0.35)] bg-[rgba(110,168,254,0.18)] px-3 py-2 text-[13px] leading-[1.5] whitespace-pre-wrap text-fg">
        {msg.content}
      </div>
    );
  }
  return (
    <div className="max-w-[92%] self-start rounded-lg rounded-bl-sm border border-glass-border bg-[rgba(255,255,255,0.05)] px-3.5 py-2.5">
      <SummaryView text={msg.content} />
    </div>
  );
}
