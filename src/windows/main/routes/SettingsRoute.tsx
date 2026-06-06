import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  getAiProvider,
  getSummaryLanguage,
  hasApiKey,
  listDevices,
  setAiProvider,
  setApiKey,
  setDevices,
  setSummaryLanguage,
} from '../../../lib/ipc';
import { SUMMARY_LANGUAGES } from '../../../lib/languages';
import {
  IconAlert,
  IconAppearance,
  IconCheck,
  IconDevices,
  IconExternal,
  IconGift,
  IconKey,
  IconLanguage,
  IconMic,
  IconSpeaker,
} from '../../../lib/icons';
import {
  useConfigStore,
  UI_SCALE_MIN,
  UI_SCALE_MAX,
  TRANSCRIPT_SCALE_MIN,
  TRANSCRIPT_SCALE_MAX,
} from '../../../state/configStore';
import type { AiProvider, ApiService, DeviceLists } from '../../../types/domain';

const FIELD_CTRL =
  'w-full flex-1 rounded-sm border border-glass-border bg-[rgba(255,255,255,0.05)] px-[11px] py-[9px] text-[13px] text-fg outline-none focus:border-accent';
const BTN =
  'cursor-pointer rounded-sm border border-[rgba(255,255,255,0.28)] bg-[rgba(255,255,255,0.1)] px-4 py-[9px] text-[13px] text-fg whitespace-nowrap shadow-liquid hover:bg-[rgba(255,255,255,0.18)]';
const H3 =
  'mb-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.06em] text-fg-faint';
const FIELD = 'mb-3.5 flex flex-col gap-1.5';
const FIELD_LABEL = 'text-[13px] text-fg-dim';

// Open external links in the system browser (Tauri), with a plain-web fallback
// so the links still work under `vite dev` outside the Tauri webview.
async function openExternal(url: string) {
  try {
    await openUrl(url);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export default function SettingsRoute() {
  const [devices, setDeviceLists] = useState<DeviceLists | null>(null);
  const [dgKey, setDgKey] = useState('');
  const [oaKey, setOaKey] = useState('');
  const [gmKey, setGmKey] = useState('');
  const [dgSaved, setDgSaved] = useState(false);
  const [oaSaved, setOaSaved] = useState(false);
  const [gmSaved, setGmSaved] = useState(false);
  const [status, setStatus] = useState('');
  // AI-summary output language ("auto" or a language code), persisted in the DB.
  const [summaryLang, setSummaryLang] = useState('auto');
  // Active AI provider ("openai" | "gemini") for summaries + live translation, persisted in the DB.
  const [aiProvider, setAiProviderState] = useState<AiProvider>('openai');

  // Device selection is shared with the Start-transcription screen via the config store.
  const inputDevice = useConfigStore((s) => s.inputDevice);
  const outputDevice = useConfigStore((s) => s.outputDevice);
  const setInputDevice = useConfigStore((s) => s.setInputDevice);
  const setOutputDevice = useConfigStore((s) => s.setOutputDevice);
  const uiScale = useConfigStore((s) => s.uiScale);
  const transcriptScale = useConfigStore((s) => s.transcriptScale);
  const glassOpacity = useConfigStore((s) => s.glassOpacity);
  const setUiScale = useConfigStore((s) => s.setUiScale);
  const setTranscriptScale = useConfigStore((s) => s.setTranscriptScale);
  const setGlassOpacity = useConfigStore((s) => s.setGlassOpacity);

  useEffect(() => {
    listDevices()
      .then((d) => {
        setDeviceLists(d);
        // Seed defaults only if nothing is selected yet, so a choice made on
        // the Start-transcription screen isn't clobbered.
        const cfg = useConfigStore.getState();
        if (cfg.inputDevice == null) {
          setInputDevice(d.input.find((x) => x.isDefault)?.id ?? d.input[0]?.id ?? null);
        }
        if (cfg.outputDevice == null) {
          setOutputDevice(d.output.find((x) => x.isDefault)?.id ?? d.output[0]?.id ?? null);
        }
      })
      .catch((e) => setStatus(`Failed to load devices: ${e}`));
    hasApiKey('deepgram')
      .then(setDgSaved)
      .catch(() => {});
    hasApiKey('openai')
      .then(setOaSaved)
      .catch(() => {});
    hasApiKey('gemini')
      .then(setGmSaved)
      .catch(() => {});
    getSummaryLanguage()
      .then(setSummaryLang)
      .catch(() => {});
    getAiProvider()
      .then(setAiProviderState)
      .catch(() => {});
  }, [setInputDevice, setOutputDevice]);

  async function saveSummaryLanguage(code: string) {
    setSummaryLang(code);
    try {
      await setSummaryLanguage(code);
      setStatus('Summary language saved.');
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  async function saveDevices() {
    try {
      await setDevices(inputDevice, outputDevice);
      setStatus('Devices saved.');
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  async function saveAiProvider(provider: AiProvider) {
    setAiProviderState(provider);
    try {
      await setAiProvider(provider);
      setStatus('AI provider saved.');
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  async function saveKey(service: ApiService) {
    const value = (service === 'deepgram' ? dgKey : service === 'openai' ? oaKey : gmKey).trim();
    if (!value) return;
    try {
      await setApiKey(service, value);
      if (service === 'deepgram') {
        setDgKey('');
        setDgSaved(true);
      } else if (service === 'openai') {
        setOaKey('');
        setOaSaved(true);
      } else {
        setGmKey('');
        setGmSaved(true);
      }
      setStatus(`${service} API key saved.`);
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  return (
    <div className="mx-auto max-w-[620px] px-8 py-7">
      <h2 className="mb-5 text-[20px] font-semibold">Settings</h2>

      <section className="mb-7">
        <h3 className={H3}>
          <HugeiconsIcon icon={IconKey} size={13} strokeWidth={1.8} aria-hidden={true} />
          API Keys
        </h3>
        <label className={FIELD}>
          <span className={FIELD_LABEL}>
            Deepgram API Key{' '}
            {dgSaved && (
              <em className="ml-1.5 inline-flex items-center gap-1 text-[11.5px] text-ok not-italic">
                <HugeiconsIcon icon={IconCheck} size={13} strokeWidth={2} aria-hidden={true} />
                saved
              </em>
            )}
          </span>
          <div className="flex gap-2">
            <input
              className={FIELD_CTRL}
              type="password"
              value={dgKey}
              onChange={(e) => setDgKey(e.target.value)}
              placeholder={dgSaved ? '••••••••••••' : 'Deepgram token…'}
            />
            <button className={BTN} onClick={() => void saveKey('deepgram')}>
              Save
            </button>
          </div>
        </label>
        {/* How to get a Deepgram key + the free-credit nudge */}
        <div className="-mt-1 mb-3.5 flex flex-col gap-1.5 rounded-sm border border-[rgba(110,168,254,0.28)] bg-[rgba(110,168,254,0.08)] px-3 py-2.5">
          <span className="inline-flex items-start gap-1.5 text-[12px] leading-[1.5] text-fg-dim">
            <HugeiconsIcon
              icon={IconGift}
              size={14}
              strokeWidth={1.8}
              className="mt-px shrink-0 text-accent"
              aria-hidden={true}
            />
            <span>
              New Deepgram accounts get <b className="text-fg">$200 in free credit</b> (~45,000
              minutes) — no credit card required.
            </span>
          </span>
          <button
            type="button"
            className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-[12.5px] text-accent hover:underline"
            onClick={() => void openExternal('https://console.deepgram.com/signup')}
          >
            Get a free Deepgram API key
            <HugeiconsIcon icon={IconExternal} size={13} strokeWidth={1.8} aria-hidden={true} />
          </button>
          <span className="text-[11px] leading-[1.5] text-fg-faint">
            Sign up, create an API key in the Deepgram console, then paste it above.
          </span>
        </div>
        <label className={FIELD}>
          <span className={FIELD_LABEL}>
            OpenAI API Key{' '}
            {oaSaved && (
              <em className="ml-1.5 inline-flex items-center gap-1 text-[11.5px] text-ok not-italic">
                <HugeiconsIcon icon={IconCheck} size={13} strokeWidth={2} aria-hidden={true} />
                saved
              </em>
            )}
          </span>
          <div className="flex gap-2">
            <input
              className={FIELD_CTRL}
              type="password"
              value={oaKey}
              onChange={(e) => setOaKey(e.target.value)}
              placeholder={oaSaved ? '••••••••••••' : 'sk-…'}
            />
            <button className={BTN} onClick={() => void saveKey('openai')}>
              Save
            </button>
          </div>
        </label>
        <button
          type="button"
          className="mb-1 inline-flex w-fit cursor-pointer items-center gap-1.5 text-[12px] text-fg-dim hover:text-accent hover:underline"
          onClick={() => void openExternal('https://platform.openai.com/api-keys')}
        >
          Get an OpenAI API key (optional — for AI summaries)
          <HugeiconsIcon icon={IconExternal} size={12} strokeWidth={1.8} aria-hidden={true} />
        </button>
        <label className={FIELD}>
          <span className={FIELD_LABEL}>
            Gemini API Key{' '}
            {gmSaved && (
              <em className="ml-1.5 inline-flex items-center gap-1 text-[11.5px] text-ok not-italic">
                <HugeiconsIcon icon={IconCheck} size={13} strokeWidth={2} aria-hidden={true} />
                saved
              </em>
            )}
          </span>
          <div className="flex gap-2">
            <input
              className={FIELD_CTRL}
              type="password"
              value={gmKey}
              onChange={(e) => setGmKey(e.target.value)}
              placeholder={gmSaved ? '••••••••••••' : 'AIza…'}
            />
            <button className={BTN} onClick={() => void saveKey('gemini')}>
              Save
            </button>
          </div>
        </label>
        <button
          type="button"
          className="mb-1 inline-flex w-fit cursor-pointer items-center gap-1.5 text-[12px] text-fg-dim hover:text-accent hover:underline"
          onClick={() => void openExternal('https://aistudio.google.com/app/apikey')}
        >
          Get a Gemini API key (optional — for AI summaries)
          <HugeiconsIcon icon={IconExternal} size={12} strokeWidth={1.8} aria-hidden={true} />
        </button>
        <label className={FIELD}>
          <span className={FIELD_LABEL}>Active AI provider</span>
          <select
            className={FIELD_CTRL}
            value={aiProvider}
            onChange={(e) => void saveAiProvider(e.target.value as AiProvider)}
          >
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
          <span className="text-[11.5px] leading-[1.4] text-fg-faint">
            Powers AI session summaries and live translation. Set the matching API key above.
          </span>
        </label>
        <p className="mt-2 text-[12px] leading-[1.5] text-fg-faint">
          Keys are stored securely in Windows Credential Manager and are never sent to the frontend.
        </p>
      </section>

      <section className="mb-7">
        <h3 className={H3}>
          <HugeiconsIcon icon={IconDevices} size={13} strokeWidth={1.8} aria-hidden={true} />
          Audio Devices
        </h3>
        <label className={FIELD}>
          <span className={`${FIELD_LABEL} inline-flex items-center gap-1.5`}>
            <HugeiconsIcon icon={IconMic} size={13} strokeWidth={1.8} aria-hidden={true} />
            Microphone
          </span>
          <select
            className={FIELD_CTRL}
            value={inputDevice ?? ''}
            onChange={(e) => setInputDevice(e.target.value || null)}
          >
            {devices?.input.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          <span className={`${FIELD_LABEL} inline-flex items-center gap-1.5`}>
            <HugeiconsIcon icon={IconSpeaker} size={13} strokeWidth={1.8} aria-hidden={true} />
            System audio source (the output to loop back)
          </span>
          <select
            className={FIELD_CTRL}
            value={outputDevice ?? ''}
            onChange={(e) => setOutputDevice(e.target.value || null)}
          >
            {devices?.output.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          className="mt-1 cursor-pointer rounded-sm border border-[rgba(255,255,255,0.3)] bg-[rgba(110,168,254,0.24)] px-4 py-[9px] text-[13px] whitespace-nowrap text-[#dbe8ff] shadow-liquid hover:bg-[rgba(110,168,254,0.34)]"
          onClick={() => void saveDevices()}
        >
          Save devices
        </button>
      </section>

      <section className="mb-7">
        <h3 className={H3}>
          <HugeiconsIcon icon={IconAppearance} size={13} strokeWidth={1.8} aria-hidden={true} />
          Appearance
        </h3>

        <div className={FIELD}>
          <span className={FIELD_LABEL}>
            UI font size
            <em className="ml-1.5 text-[11.5px] text-fg-faint not-italic">
              {Math.round(uiScale * 100)}%
            </em>
          </span>
          <input
            type="range"
            min={UI_SCALE_MIN}
            max={UI_SCALE_MAX}
            step={0.05}
            value={uiScale}
            onChange={(e) => setUiScale(Number(e.target.value))}
            className="w-full cursor-pointer accent-accent"
          />
          <span className="text-[11.5px] leading-[1.4] text-fg-faint">
            Scales the whole interface (text, buttons, panels).
          </span>
        </div>

        <div className={FIELD}>
          <span className={FIELD_LABEL}>
            Transcript font size
            <em className="ml-1.5 text-[11.5px] text-fg-faint not-italic">
              {Math.round(transcriptScale * 100)}%
            </em>
          </span>
          <input
            type="range"
            min={TRANSCRIPT_SCALE_MIN}
            max={TRANSCRIPT_SCALE_MAX}
            step={0.05}
            value={transcriptScale}
            onChange={(e) => setTranscriptScale(Number(e.target.value))}
            className="w-full cursor-pointer accent-accent"
          />
          <span className="text-[11.5px] leading-[1.4] text-fg-faint">
            Transcript text &amp; speaker labels, in live recording and history.
          </span>
          <div className="mt-1 rounded-sm border border-glass-border bg-[rgba(255,255,255,0.04)] px-3 py-2">
            <div
              className="tracking-[0.05em] text-accent uppercase"
              style={{ fontSize: `${11 * transcriptScale}px` }}
            >
              You
            </div>
            <div
              className="leading-[1.5] text-fg"
              style={{ fontSize: `${14 * transcriptScale}px` }}
            >
              Sample live transcript line.
            </div>
          </div>
        </div>

        <div className={FIELD}>
          <span className={FIELD_LABEL}>
            Background transparency
            <em className="ml-1.5 text-[11.5px] text-fg-faint not-italic">
              {Math.round((1 - glassOpacity) * 100)}%
            </em>
          </span>
          <input
            type="range"
            min={5}
            max={85}
            step={5}
            value={Math.round((1 - glassOpacity) * 100)}
            onChange={(e) => setGlassOpacity(1 - Number(e.target.value) / 100)}
            className="w-full cursor-pointer accent-accent"
          />
          <span className="text-[11.5px] leading-[1.4] text-fg-faint">
            Higher = more see-through; the desktop behind shows through more.
          </span>
        </div>
      </section>

      <section className="mb-7">
        <h3 className={H3}>
          <HugeiconsIcon icon={IconLanguage} size={13} strokeWidth={1.8} aria-hidden={true} />
          Language
        </h3>
        <label className={FIELD}>
          <span className={FIELD_LABEL}>AI summary language</span>
          <select
            className={FIELD_CTRL}
            value={summaryLang}
            onChange={(e) => void saveSummaryLanguage(e.target.value)}
          >
            {SUMMARY_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <span className="text-[11.5px] leading-[1.4] text-fg-faint">
            Language used for AI session summaries. "Auto" matches the transcript language. Saved to
            the database.
          </span>
        </label>
        <p className="mt-2 text-[12px] leading-[1.5] text-fg-faint">
          All languages now use Deepgram's <b>Nova-3</b> model (best accuracy, including
          Indonesian). Pick the language on the main screen before you start recording. The{' '}
          <i>Auto-detect (multilingual)</i> option recognizes a mix of languages automatically, but
          choosing one specific language is usually more accurate.
        </p>
      </section>

      {status && (
        <p
          className={`mt-2 inline-flex items-center gap-1.5 text-[12.5px] ${
            /^(Error|Failed)/.test(status) ? 'text-[#ffb454]' : 'text-ok'
          }`}
        >
          <HugeiconsIcon
            icon={/^(Error|Failed)/.test(status) ? IconAlert : IconCheck}
            size={14}
            strokeWidth={1.8}
            aria-hidden={true}
          />
          {status}
        </p>
      )}
    </div>
  );
}
