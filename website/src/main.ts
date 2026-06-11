import './styles.css';

import {
  LATEST_RELEASE_API,
  REPO_API,
  detectOS,
  formatVersion,
  primaryDownload,
} from './lib/release';

// `?motion` forces the full experience on reduced-motion machines (QA/demos).
const reducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  !new URLSearchParams(window.location.search).has('motion');

/* ------------------------------------------------------------------
   Download CTA — point the hero button at the visitor's OS and badge
   the matching card in the download grid.
   ------------------------------------------------------------------ */
function wireDownloadCta(): void {
  const os = detectOS(navigator.platform ?? '', navigator.userAgent);
  const cta = document.querySelector<HTMLAnchorElement>('#cta-primary');
  const label = document.querySelector<HTMLSpanElement>('#cta-label');
  if (!cta || !label) return;

  const dl = primaryDownload(os);
  if (dl) {
    cta.href = dl.url;
    label.textContent = `Download for ${dl.shortName}`;
  } else {
    // Mobile/unknown: send visitors to the download grid instead of a binary.
    cta.href = '#download';
    label.textContent = 'Download';
  }

  if (os !== 'unknown') {
    const card = document.querySelector<HTMLElement>(`[data-os="${os}"]`);
    card?.classList.add('ring-2', 'ring-accent/60');
    card?.querySelector('.js-detected')?.classList.remove('hidden');
  }
}

/* ------------------------------------------------------------------
   GitHub API — latest version + star count. Best-effort: on failure
   (rate limit, offline) the neutral defaults stay in place.
   ------------------------------------------------------------------ */
async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

function formatStars(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(count);
}

async function wireGitHubData(): Promise<void> {
  try {
    const release = await fetchJson(LATEST_RELEASE_API);
    const version = formatVersion(typeof release.tag_name === 'string' ? release.tag_name : null);
    if (version) {
      for (const id of ['hero-version', 'dl-version']) {
        const el = document.getElementById(id);
        if (el) el.textContent = version;
      }
    }
  } catch {
    /* keep "latest release" */
  }

  try {
    const repo = await fetchJson(REPO_API);
    if (typeof repo.stargazers_count === 'number') {
      const stars = formatStars(repo.stargazers_count);
      document.querySelectorAll<HTMLElement>('.js-star-count').forEach((el) => {
        const current = el.textContent?.trim() ?? '';
        el.textContent = current === 'Star' ? `Star · ${stars}` : stars;
        el.classList.remove('hidden');
      });
    }
  } catch {
    /* keep "Star" */
  }
}

/* ------------------------------------------------------------------
   Hero demo — a scripted meeting streams through the transcript panel
   word by word (interim → final), ends in an AI summary, then loops.
   The pill's pause/stop buttons control it.
   ------------------------------------------------------------------ */
interface ScriptLine {
  channel: 'you' | 'remote';
  text: string;
}

const SCRIPT: ScriptLine[] = [
  { channel: 'remote', text: 'Morning! Can everyone see the release dashboard?' },
  { channel: 'you', text: "Yep — build's green and the installer looks good." },
  { channel: 'remote', text: "Great. Let's ship 0.9 on Friday, then." },
  { channel: 'you', text: "Deal. I'll draft the changelog right after this call." },
];

const MAX_VISIBLE_LINES = 3;
const WORD_MS = 130;
const LINE_PAUSE_MS = 650;
const SUMMARY_HOLD_MS = 4500;

class CaptionDemo {
  private paused = false;
  private generation = 0;
  private seconds = 0;

  constructor(
    private readonly list: HTMLUListElement,
    private readonly summary: HTMLElement,
    private readonly timer: HTMLElement,
  ) {}

  start(): void {
    window.setInterval(() => {
      if (this.paused) return;
      this.seconds += 1;
      const m = String(Math.floor(this.seconds / 60)).padStart(2, '0');
      const s = String(this.seconds % 60).padStart(2, '0');
      this.timer.textContent = `${m}:${s}`;
    }, 1000);
    void this.loop(this.generation);
  }

  togglePause(): boolean {
    this.paused = !this.paused;
    return this.paused;
  }

  restart(): void {
    this.paused = false;
    this.generation += 1;
    this.seconds = 0;
    this.timer.textContent = '00:00';
    void this.loop(this.generation);
  }

  /** Resolves after ms of *unpaused* time; aborts (rejects) on restart. */
  private async wait(ms: number, gen: number): Promise<void> {
    let elapsed = 0;
    while (elapsed < ms) {
      await new Promise((r) => window.setTimeout(r, 50));
      if (gen !== this.generation) throw new Error('restarted');
      if (!this.paused) elapsed += 50;
    }
  }

  private appendLine(line: ScriptLine): { li: HTMLLIElement; text: HTMLParagraphElement } {
    const li = document.createElement('li');
    li.className = 'cap-line cap-interim flex items-start gap-2.5';

    const chip = document.createElement('span');
    const isYou = line.channel === 'you';
    chip.className = isYou
      ? 'mt-0.5 rounded-md border border-[rgba(110,168,254,0.4)] bg-[rgba(110,168,254,0.12)] px-1.5 py-0.5 font-mono text-[10px] text-accent'
      : 'text-accent-2 mt-0.5 rounded-md border border-[rgba(183,148,246,0.4)] bg-[rgba(183,148,246,0.12)] px-1.5 py-0.5 font-mono text-[10px]';
    chip.textContent = isYou ? 'You' : 'Remote';

    const text = document.createElement('p');
    text.className = 'cap-text flex-1 text-[13.5px] leading-snug';

    li.append(chip, text);
    this.list.append(li);
    return { li, text };
  }

  private async trimLines(gen: number): Promise<void> {
    while (this.list.children.length > MAX_VISIBLE_LINES) {
      const first = this.list.firstElementChild as HTMLElement;
      first.classList.add('cap-leaving');
      await this.wait(300, gen);
      first.remove();
    }
  }

  private async loop(gen: number): Promise<void> {
    try {
      this.list.replaceChildren();
      this.summary.classList.add('hidden');

      for (;;) {
        for (const line of SCRIPT) {
          const { li, text } = this.appendLine(line);
          await this.trimLines(gen);
          for (const word of line.text.split(' ')) {
            text.textContent = text.textContent ? `${text.textContent} ${word}` : word;
            await this.wait(WORD_MS, gen);
          }
          li.classList.remove('cap-interim');
          await this.wait(LINE_PAUSE_MS, gen);
        }

        this.summary.classList.remove('hidden');
        this.summary.classList.add('sum-pop');
        await this.wait(SUMMARY_HOLD_MS, gen);

        this.summary.classList.add('hidden');
        this.summary.classList.remove('sum-pop');
        this.list.replaceChildren();
        this.seconds = 0;
      }
    } catch {
      /* restarted — the new loop() call owns the stage now */
    }
  }
}

function wireDemo(): void {
  const list = document.querySelector<HTMLUListElement>('#demo-captions');
  const summary = document.querySelector<HTMLElement>('#demo-summary');
  const timer = document.querySelector<HTMLElement>('#demo-timer');
  const pauseBtn = document.querySelector<HTMLButtonElement>('#demo-pause');
  const stopBtn = document.querySelector<HTMLButtonElement>('#demo-stop');
  if (!list || !summary || !timer || !pauseBtn || !stopBtn) return;

  if (reducedMotion) {
    // Static final state: full conversation + summary, no loop.
    summary.classList.remove('hidden');
    timer.textContent = '02:41';
    list.querySelectorAll('.cap-interim').forEach((li) => li.classList.remove('cap-interim'));
    return;
  }

  const demo = new CaptionDemo(list, summary, timer);
  demo.start();

  pauseBtn.addEventListener('click', () => {
    const paused = demo.togglePause();
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.setAttribute('aria-label', paused ? 'Resume the demo' : 'Pause the demo');
    pauseBtn.querySelector('.js-icon-pause')?.classList.toggle('hidden', paused);
    pauseBtn.querySelector('.js-icon-play')?.classList.toggle('hidden', !paused);
  });

  stopBtn.addEventListener('click', () => {
    demo.restart();
    pauseBtn.setAttribute('aria-pressed', 'false');
    pauseBtn.querySelector('.js-icon-pause')?.classList.remove('hidden');
    pauseBtn.querySelector('.js-icon-play')?.classList.add('hidden');
  });
}

/* ------------------------------------------------------------------
   Lite YouTube embed — swap the thumbnail for the real iframe only
   when the visitor asks for it.
   ------------------------------------------------------------------ */
function wireVideo(): void {
  const shell = document.querySelector<HTMLElement>('#video-shell');
  if (!shell) return;
  shell.addEventListener(
    'click',
    () => {
      const iframe = document.createElement('iframe');
      iframe.className = 'absolute inset-0 h-full w-full';
      iframe.src = 'https://www.youtube-nocookie.com/embed/al1_YU_ILXs?autoplay=1';
      iframe.title = 'sososo demo video';
      iframe.allow =
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      shell.replaceChildren(iframe);
      shell.classList.remove('cursor-pointer');
    },
    { once: true },
  );
}

/* ------------------------------------------------------------------
   Scroll reveals.
   ------------------------------------------------------------------ */
function wireReveals(): void {
  if (reducedMotion) return; // CSS shows everything immediately
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
}

wireDownloadCta();
void wireGitHubData();
wireDemo();
wireVideo();
wireReveals();

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
