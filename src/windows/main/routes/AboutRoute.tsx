import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { getVersion } from '@tauri-apps/api/app';
import { IconGithub, IconStar } from '../../../lib/icons';

const GITHUB_URL = 'https://github.com/yusupsupriyadi/sososo';

const BTN =
  'inline-flex items-center gap-2 cursor-pointer rounded-sm border border-[rgba(255,255,255,0.28)] bg-[rgba(255,255,255,0.1)] px-4 py-[9px] text-[13px] text-fg whitespace-nowrap no-underline shadow-liquid hover:bg-[rgba(255,255,255,0.18)]';
const BTN_PRIMARY =
  'inline-flex items-center gap-2 cursor-pointer rounded-sm border border-[rgba(255,255,255,0.3)] bg-[rgba(110,168,254,0.22)] px-4 py-[9px] text-[13px] font-semibold text-[#dbe8ff] whitespace-nowrap no-underline shadow-liquid hover:bg-[rgba(110,168,254,0.32)]';

// Open external links in the system browser (Tauri), with a plain-web fallback
// so the page still works under `vite dev` outside the Tauri webview.
async function openExternal(url: string) {
  try {
    await openUrl(url);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export default function AboutRoute() {
  const [version, setVersion] = useState('');

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 p-8 text-center">
      <img
        src="/sososo_brand_logo_white.png"
        alt="sososo"
        className="w-52 max-w-[70%] opacity-95 select-none"
        draggable={false}
      />

      {version && <span className="text-[12px] text-fg-faint">Version {version}</span>}

      <p className="max-w-md text-[13px] leading-relaxed text-fg-dim">
        Real-time meeting &amp; audio transcription — live captions from your system audio and
        microphone, with AI summaries.
      </p>

      <span className="rounded-full border border-glass-border bg-[rgba(255,255,255,0.06)] px-3 py-1 text-[12px] text-fg-dim">
        Open source (AGPL-3.0) · Commercial license available
      </span>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
        <button type="button" className={BTN} onClick={() => void openExternal(GITHUB_URL)}>
          <HugeiconsIcon icon={IconGithub} size={16} strokeWidth={1.8} aria-hidden={true} />
          View on GitHub
        </button>
        <button type="button" className={BTN_PRIMARY} onClick={() => void openExternal(GITHUB_URL)}>
          <HugeiconsIcon icon={IconStar} size={16} strokeWidth={1.8} aria-hidden={true} />
          Star on GitHub
        </button>
      </div>

      <p className="max-w-sm text-[12px] leading-relaxed text-fg-faint">
        The community edition is free and open source under the AGPL-3.0; a commercial license is
        available for proprietary use. If it&apos;s useful to you, please give it a star on GitHub —
        it&apos;s the best way to support the project and helps others discover it.
      </p>

      <p className="mt-2 text-[11px] text-fg-faint">
        Built with Tauri, React, Deepgram &amp; OpenAI.
      </p>
    </div>
  );
}
