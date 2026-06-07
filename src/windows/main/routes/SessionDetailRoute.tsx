import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  IconAi,
  IconAlert,
  IconBack,
  IconCalendar,
  IconCheck,
  IconDelete,
  IconLanguage,
  IconLines,
  IconMic,
  IconNoTranscript,
  IconRegenerate,
  IconRemote,
  IconRename,
  IconSpeaker,
} from '../../../lib/icons';
import {
  deleteSession,
  getSession,
  getSummaryLanguage,
  renameSession,
  renameSpeaker,
  setSummaryLanguage,
  summarizeSession,
  translateSegment,
} from '../../../lib/ipc';
import { formatDateTime } from '../../../lib/format';
import { speakerColor } from '../../../lib/speaker';
import { languageLabel, SUMMARY_LANGUAGES, TRANSLATE_TARGETS } from '../../../lib/languages';
import { useLibraryStore } from '../../../state/libraryStore';
import { useConfigStore } from '../../../state/configStore';
import type { SessionDetail, Source, StoredSegment } from '../../../types/domain';

const ACTION_BTN =
  'inline-flex items-center gap-1.5 cursor-pointer rounded-sm border border-[rgba(255,255,255,0.25)] bg-[rgba(255,255,255,0.08)] px-[11px] py-1.5 text-[12.5px] text-fg-dim whitespace-nowrap shadow-liquid hover:bg-hover hover:text-fg';

/** Compact dropdown styling for the in-panel language selectors (summary + translate). */
const SELECT_CLS =
  'max-w-[170px] cursor-pointer truncate rounded-sm border border-glass-border bg-[rgba(255,255,255,0.06)] px-2 py-[5px] text-[12px] text-fg outline-none focus:border-accent disabled:cursor-default disabled:opacity-60';

/** How many saved lines to translate at once when batch-translating a transcript. */
const TRANSLATE_CONCURRENCY = 4;

export default function SessionDetailRoute() {
  const { id } = useParams();
  const sessionId = Number(id);
  const navigate = useNavigate();
  const refreshLibrary = useLibraryStore((s) => s.refresh);
  const transcriptScale = useConfigStore((s) => s.transcriptScale);
  // Reuse the live-translate target language so it stays consistent (persisted).
  const targetLanguage = useConfigStore((s) => s.targetLanguage);
  const setTargetLanguage = useConfigStore((s) => s.setTargetLanguage);

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  // AI-summary output language (a code or "auto"); mirrors the global setting.
  const [summaryLang, setSummaryLang] = useState('auto');
  const [editingSpeaker, setEditingSpeaker] = useState<number | null>(null);
  const [speakerDraft, setSpeakerDraft] = useState('');
  // Batch transcript translation: in-flight flag, progress counter, and the set
  // of segment indices currently being translated (for the per-line "Translating…").
  const [translating, setTranslating] = useState(false);
  const [tProgress, setTProgress] = useState({ done: 0, total: 0 });
  const [tPending, setTPending] = useState<Set<number>>(new Set());
  const [err, setErr] = useState('');

  const speakers = useMemo(() => distinctSpeakers(detail?.segments ?? []), [detail]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setEditing(false);
    setConfirmDelete(false);
    setSummarizing(false);
    setEditingSpeaker(null);
    setTranslating(false);
    setTProgress({ done: 0, total: 0 });
    setTPending(new Set());
    setErr('');
    getSession(sessionId)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(String(e));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [sessionId]);

  // Load the persisted AI-summary output language once so the dropdown reflects
  // the global setting (Settings → Language). Changing it here writes back.
  useEffect(() => {
    getSummaryLanguage()
      .then(setSummaryLang)
      .catch(() => {});
  }, []);

  async function saveTitle() {
    const next = titleDraft.trim();
    setEditing(false);
    if (!detail || !next || next === detail.session.title) return;
    try {
      await renameSession(sessionId, next);
      setDetail({ ...detail, session: { ...detail.session, title: next } });
      refreshLibrary(); // sidebar shows the new title without a remount
    } catch (e) {
      setErr(String(e));
    }
  }

  // Rename a speaker label across the whole session, then optimistically rewrite
  // the matching segments so the panel + transcript update without a refetch.
  async function saveSpeaker(entry: SpeakerEntry) {
    const next = speakerDraft.trim();
    setEditingSpeaker(null);
    if (!detail || !next || next === entry.display) return;
    try {
      await renameSpeaker(sessionId, entry.stored, next);
      setDetail({
        ...detail,
        segments: detail.segments.map((s) =>
          (s.speaker ?? null) === entry.stored ? { ...s, speaker: next } : s,
        ),
      });
    } catch (e) {
      setErr(String(e));
    }
  }

  async function doDelete() {
    try {
      await deleteSession(sessionId);
      refreshLibrary(); // drop the deleted session from the sidebar list
      navigate('/main');
    } catch (e) {
      setErr(String(e));
    }
  }

  async function doSummarize() {
    setErr('');
    setSummarizing(true);
    try {
      // Resolve the chosen summary-language code to what the backend expects:
      // "auto" verbatim, or a human-readable language name for a specific one.
      const target = summaryLang === 'auto' ? 'auto' : languageLabel(summaryLang);
      await summarizeSession(sessionId, target);
      // Refetch so summary, model, and timestamp come straight from the DB.
      const fresh = await getSession(sessionId);
      if (fresh) setDetail(fresh);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSummarizing(false);
    }
  }

  function onSummaryLang(code: string) {
    setSummaryLang(code);
    // Persist to the global app setting so the choice is remembered everywhere.
    void setSummaryLanguage(code).catch(() => {});
  }

  // Translate every saved transcript line into the selected target language via
  // the active AI provider. `translate_segment` is idempotent (re-running only
  // re-translates lines not yet in the target language), and persists each result
  // to the DB, so we just mirror it into local state for a progressive fill-in.
  // A different target overwrites a line's previous translation (single column).
  async function doTranslate() {
    if (!detail || translating) return;
    setErr('');
    const targetName = languageLabel(targetLanguage);

    // Lines that still need work (skip empty and already-in-target lines).
    const work: number[] = [];
    detail.segments.forEach((s, i) => {
      if (!s.text.trim()) return;
      if (s.translation && s.translationLang === targetName) return;
      work.push(i);
    });
    if (work.length === 0) return;

    setTranslating(true);
    setTProgress({ done: 0, total: work.length });
    setTPending(new Set(work));
    let failed = 0;

    const sid = sessionId;
    const translateOne = async (i: number) => {
      const seg = detail.segments[i];
      try {
        const translated = await translateSegment(sid, seg.segmentId, seg.text, targetName);
        setDetail((prev) => {
          if (!prev) return prev;
          const next = prev.segments.slice();
          next[i] = { ...next[i], translation: translated, translationLang: targetName };
          return { ...prev, segments: next };
        });
      } catch (e) {
        failed += 1;
        throw e;
      } finally {
        setTPending((prev) => {
          const n = new Set(prev);
          n.delete(i);
          return n;
        });
        setTProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };

    // Run the first line alone so a fatal error (e.g. missing API key) aborts the
    // whole batch instead of firing one failing request per line.
    try {
      await translateOne(work[0]);
    } catch (e) {
      setErr(String(e));
      setTranslating(false);
      setTPending(new Set());
      return;
    }

    // Translate the rest with a small concurrency pool; per-line errors are
    // tolerated (the line is just left untranslated and can be retried).
    const rest = work.slice(1);
    let cursor = 0;
    const worker = async () => {
      while (cursor < rest.length) {
        const idx = rest[cursor++];
        try {
          await translateOne(idx);
        } catch {
          /* tolerated — counted in `failed` */
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(TRANSLATE_CONCURRENCY, rest.length) }, worker));

    setTranslating(false);
    if (failed > 0) setErr(`${failed} line(s) failed to translate — try again.`);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-[13px] text-fg-faint">Loading…</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-[420px] text-center text-fg-dim">
          <h2 className="mb-2 text-[18px] font-semibold text-fg">Session not found</h2>
          <p className="text-[13.5px] leading-[1.5]">
            This recording may have been deleted.{' '}
            <Link to="/main" className="inline-flex items-center gap-1 text-accent">
              <HugeiconsIcon icon={IconBack} size={13} strokeWidth={1.8} aria-hidden={true} />
              <span className="underline">Back to home</span>
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const { session, segments } = detail;

  return (
    <div className="mx-auto max-w-[760px] px-7 py-6">
      <div className="mb-5 border-b border-glass-border pb-3.5">
        <div className="flex items-center gap-3">
          {editing ? (
            <input
              className="flex-1 rounded-sm border border-accent bg-[rgba(255,255,255,0.06)] px-2.5 py-[7px] text-[18px] font-semibold text-fg outline-none"
              value={titleDraft}
              autoFocus
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveTitle();
                if (e.key === 'Escape') setEditing(false);
              }}
              onBlur={() => void saveTitle()}
            />
          ) : (
            <h2 className="m-0 flex-1 text-[19px] font-semibold break-words text-fg">
              {session.title}
            </h2>
          )}
          <div className="flex shrink-0 gap-1.5">
            {!editing && (
              <button
                className={ACTION_BTN}
                onClick={() => {
                  setTitleDraft(session.title);
                  setEditing(true);
                }}
              >
                <HugeiconsIcon icon={IconRename} size={14} strokeWidth={1.8} aria-hidden={true} />
                Rename
              </button>
            )}
            {confirmDelete ? (
              <>
                <button
                  className="cursor-pointer rounded-sm border border-[rgba(255,93,93,0.55)] bg-[rgba(255,93,93,0.24)] px-[11px] py-1.5 text-[12.5px] whitespace-nowrap text-[#ffd9d9] shadow-liquid hover:bg-hover hover:text-fg"
                  onClick={() => void doDelete()}
                >
                  Delete permanently
                </button>
                <button className={ACTION_BTN} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-[rgba(255,255,255,0.25)] bg-[rgba(255,255,255,0.08)] px-[11px] py-1.5 text-[12.5px] whitespace-nowrap text-fg-dim shadow-liquid hover:border-[rgba(255,93,93,0.4)] hover:bg-hover hover:text-[#ffb4b4]"
                onClick={() => setConfirmDelete(true)}
              >
                <HugeiconsIcon icon={IconDelete} size={14} strokeWidth={1.8} aria-hidden={true} />
                Delete
              </button>
            )}
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-fg-faint">
          <span className="inline-flex items-center gap-1.5">
            <HugeiconsIcon icon={IconCalendar} size={13} strokeWidth={1.8} aria-hidden={true} />
            {formatDateTime(session.startedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HugeiconsIcon icon={IconLanguage} size={13} strokeWidth={1.8} aria-hidden={true} />
            {languageLabel(session.language)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HugeiconsIcon icon={IconLines} size={13} strokeWidth={1.8} aria-hidden={true} />
            {session.segmentCount} lines
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HugeiconsIcon
              icon={session.systemOnly ? IconSpeaker : IconMic}
              size={13}
              strokeWidth={1.8}
              aria-hidden={true}
            />
            {session.systemOnly ? 'System only' : 'System + Microphone'}
          </span>
        </div>
      </div>

      {segments.length > 0 && (
        <section className="mb-[22px] rounded-md border border-glass-border bg-[rgba(110,168,254,0.07)] px-[18px] py-4">
          <div className="mb-2.5 flex items-center justify-between gap-2.5">
            <h3 className="m-0 inline-flex items-center gap-1.5 text-[12px] tracking-[0.06em] text-accent uppercase">
              <HugeiconsIcon icon={IconAi} size={14} strokeWidth={1.8} aria-hidden={true} />
              AI Summary
            </h3>
            <div className="flex shrink-0 items-center gap-1.5">
              <select
                className={SELECT_CLS}
                value={summaryLang}
                onChange={(e) => onSummaryLang(e.target.value)}
                disabled={summarizing}
                title="Summary output language"
                aria-label="Summary output language"
              >
                {SUMMARY_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
              {session.summary && (
                <button
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-[rgba(255,255,255,0.25)] bg-[rgba(255,255,255,0.08)] px-[11px] py-1.5 text-[12.5px] font-medium whitespace-nowrap text-fg-dim shadow-liquid enabled:hover:bg-hover disabled:cursor-default disabled:opacity-60"
                  onClick={() => void doSummarize()}
                  disabled={summarizing}
                >
                  {summarizing ? (
                    'Processing…'
                  ) : (
                    <>
                      <HugeiconsIcon
                        icon={IconRegenerate}
                        size={14}
                        strokeWidth={1.8}
                        aria-hidden={true}
                      />
                      Regenerate
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {session.summary ? (
            <>
              <SummaryView text={session.summary} />
              {session.summarizedAt && (
                <p className="mt-2.5 text-[11px] text-fg-faint">
                  Created {formatDateTime(session.summarizedAt)}
                  {session.summaryModel ? ` · ${session.summaryModel}` : ''}
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="m-0 text-[13px] leading-[1.5] text-fg-dim">
                Finish this transcript by generating an automatic summary — overview, key points,
                and action items — using OpenAI.
              </p>
              <button
                className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-[rgba(255,255,255,0.3)] bg-[rgba(110,168,254,0.24)] px-4 py-[9px] text-[13px] font-semibold whitespace-nowrap text-[#dbe8ff] shadow-liquid enabled:hover:bg-[rgba(110,168,254,0.34)] disabled:cursor-default disabled:opacity-60"
                onClick={() => void doSummarize()}
                disabled={summarizing}
              >
                {summarizing ? (
                  'Generating summary…'
                ) : (
                  <>
                    <HugeiconsIcon
                      icon={IconCheck}
                      size={16}
                      strokeWidth={1.8}
                      aria-hidden={true}
                    />
                    Finish &amp; Summarize
                  </>
                )}
              </button>
            </div>
          )}
        </section>
      )}

      {segments.length > 0 && (
        <section className="mb-4 rounded-md border border-glass-border bg-[rgba(255,255,255,0.04)] px-[18px] py-3.5">
          <h3 className="mb-2.5 inline-flex items-center gap-1.5 text-[12px] tracking-[0.06em] text-fg-faint uppercase">
            <HugeiconsIcon icon={IconSpeaker} size={14} strokeWidth={1.8} aria-hidden={true} />
            Speakers
          </h3>
          <div className="flex flex-wrap gap-2">
            {speakers.map((sp, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2 rounded-full border border-glass-border bg-[rgba(255,255,255,0.06)] py-1 pr-1.5 pl-2.5"
              >
                {editingSpeaker === i ? (
                  <input
                    className="w-[120px] rounded-sm border border-accent bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[12.5px] text-fg outline-none"
                    value={speakerDraft}
                    autoFocus
                    onChange={(e) => setSpeakerDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveSpeaker(sp);
                      if (e.key === 'Escape') setEditingSpeaker(null);
                    }}
                    onBlur={() => void saveSpeaker(sp)}
                  />
                ) : (
                  <>
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: speakerColor(sp.source, sp.display) }}
                      aria-hidden={true}
                    />
                    <span className="text-[12.5px] font-medium text-fg">{sp.display}</span>
                    <span className="text-[11px] text-fg-faint">{sp.count}</span>
                    <button
                      className="inline-flex cursor-pointer items-center rounded-full p-1 text-fg-faint hover:bg-hover hover:text-fg"
                      aria-label={`Rename ${sp.display}`}
                      onClick={() => {
                        setSpeakerDraft(sp.display);
                        setEditingSpeaker(i);
                      }}
                    >
                      <HugeiconsIcon
                        icon={IconRename}
                        size={13}
                        strokeWidth={1.8}
                        aria-hidden={true}
                      />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {segments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-fg-faint">
          <HugeiconsIcon icon={IconNoTranscript} size={32} strokeWidth={1.5} aria-hidden={true} />
          <p className="text-[13px]">No transcript saved for this session.</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-2.5">
            <h3 className="m-0 inline-flex items-center gap-1.5 text-[12px] tracking-[0.06em] text-fg-faint uppercase">
              <HugeiconsIcon icon={IconLanguage} size={14} strokeWidth={1.8} aria-hidden={true} />
              Transcript
            </h3>
            <div className="flex shrink-0 items-center gap-1.5">
              <select
                className={SELECT_CLS}
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                disabled={translating}
                title="Translate transcript to"
                aria-label="Translate transcript to"
              >
                {TRANSLATE_TARGETS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-[rgba(255,255,255,0.25)] bg-[rgba(255,255,255,0.08)] px-[11px] py-1.5 text-[12.5px] font-medium whitespace-nowrap text-fg-dim shadow-liquid enabled:hover:bg-hover disabled:cursor-default disabled:opacity-60"
                onClick={() => void doTranslate()}
                disabled={translating}
              >
                {translating ? (
                  `Translating ${tProgress.done}/${tProgress.total}…`
                ) : (
                  <>
                    <HugeiconsIcon
                      icon={IconLanguage}
                      size={14}
                      strokeWidth={1.8}
                      aria-hidden={true}
                    />
                    Translate
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {segments.map((s, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                <span
                  className="inline-flex items-center gap-1 font-semibold tracking-[0.02em]"
                  style={{
                    fontSize: `${11 * transcriptScale}px`,
                    color: speakerColor(s.source, s.speaker),
                  }}
                >
                  <HugeiconsIcon
                    icon={s.source === 'you' ? IconMic : IconRemote}
                    size={Math.round(12 * transcriptScale)}
                    strokeWidth={2}
                    aria-hidden={true}
                  />
                  {s.speaker ?? (s.source === 'you' ? 'You' : 'Speaker')}
                </span>
                <span
                  className="leading-[1.55] text-fg"
                  style={{ fontSize: `${14 * transcriptScale}px` }}
                >
                  {s.text}
                </span>
                {s.translation ? (
                  <span
                    className="mt-0.5 border-l-2 border-[rgba(255,192,77,0.55)] pl-2 text-[#ffc04d]"
                    style={{ fontSize: `${13 * transcriptScale}px` }}
                  >
                    {s.translation}
                  </span>
                ) : tPending.has(i) ? (
                  <span
                    className="mt-0.5 border-l-2 border-[rgba(255,192,77,0.35)] pl-2 text-fg-faint italic"
                    style={{ fontSize: `${13 * transcriptScale}px` }}
                  >
                    Translating…
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}

      {err && (
        <p className="mt-4 flex items-start gap-2 rounded-sm border border-[rgba(255,180,84,0.25)] bg-[rgba(255,180,84,0.1)] px-3 py-2 text-[12.5px] text-[#ffb454]">
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
  );
}

/**
 * Minimal Markdown renderer for the summary: headings (section + sub), bullet &
 * numbered lists, paragraphs, and inline emphasis (**bold**, *italic*, `code`).
 * The AI emits a controlled Markdown subset, so a full parser library is overkill.
 */
function SummaryView({ text }: { text: string }) {
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

/** One distinct speaker in a session: the raw stored label (null = un-diarized),
 *  its display name, the source (for icon/colour), and how many lines it has. */
interface SpeakerEntry {
  stored: string | null;
  display: string;
  source: Source;
  count: number;
}

/** Distinct speakers in first-appearance order. Lines sharing one stored label
 *  group together; a remote line with no diarization (`speaker == null`) becomes
 *  the "Speaker" group. */
function distinctSpeakers(segments: StoredSegment[]): SpeakerEntry[] {
  const byKey = new Map<string, SpeakerEntry>();
  for (const s of segments) {
    const key = s.speaker ?? ' ';
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byKey.set(key, {
        stored: s.speaker ?? null,
        display: s.speaker ?? (s.source === 'you' ? 'You' : 'Speaker'),
        source: s.source,
        count: 1,
      });
    }
  }
  return [...byKey.values()];
}
