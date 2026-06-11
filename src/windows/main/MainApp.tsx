import { useEffect, useRef } from 'react';
import { Routes, Route, useMatch, useNavigate } from 'react-router-dom';
import { useTranscriptStream } from '../../hooks/useTranscriptStream';
import { useSessionStore } from '../../state/sessionStore';
import { useTranscriptStore } from '../../state/transcriptStore';
import { useConfigStore } from '../../state/configStore';
import { checkOnLaunch } from '../../lib/updater';
import { setCloseToTray, setGlobalShortcutEnabled } from '../../lib/ipc';
import { onRecordingToggle } from '../../lib/events';
import { handleRecordingToggle } from '../../lib/recordingToggle';
import Titlebar from './Titlebar';
import UpdateBanner from './UpdateBanner';
import SessionSidebar from './SessionSidebar';
import RecordingView from './RecordingView';
import LibraryRoute from './routes/LibraryRoute';
import SettingsRoute from './routes/SettingsRoute';
import SessionDetailRoute from './routes/SessionDetailRoute';
import SearchRoute from './routes/SearchRoute';
import AboutRoute from './routes/AboutRoute';
import ChatPanel from './routes/sessionDetail/ChatPanel';

export default function MainApp() {
  useTranscriptStream();
  const state = useSessionStore((s) => s.state);
  const sessionId = useSessionStore((s) => s.sessionId);
  const uiScale = useConfigStore((s) => s.uiScale);
  const glassOpacity = useConfigStore((s) => s.glassOpacity);
  const closeToTray = useConfigStore((s) => s.closeToTray);
  const globalShortcutEnabled = useConfigStore((s) => s.globalShortcutEnabled);
  const navigate = useNavigate();
  const prev = useRef(state);
  // The transcription-result page (session detail) gets a third shell column:
  // the transcript chat, rendered as its own glass card beside the sidebar and
  // main content. Matching the route here (instead of inside the route) keeps it
  // a real sibling column rather than something floating over the content.
  const sessionMatch = useMatch('/main/session/:id');
  const detailSessionId = sessionMatch ? Number(sessionMatch.params.id) : null;

  // While a session is active the whole window becomes the transcription view.
  const inSession =
    state === 'starting' ||
    state === 'recording' ||
    state === 'stopping' ||
    state === 'reconnecting';

  // When a session ends, jump to its detail (where the summary lives) if it
  // captured anything; otherwise fall back to the home/library view.
  useEffect(() => {
    if (prev.current !== 'stopped' && state === 'stopped') {
      const hasFinal = useTranscriptStore.getState().segments.some((s) => s.isFinal);
      if (hasFinal && sessionId != null) {
        // Mark the "just finished" path so the detail view can auto-summarize
        // (opening an old session from history carries no such state).
        navigate(`/main/session/${sessionId}`, { state: { autoSummarize: true } });
      } else {
        navigate('/main');
      }
    }
    prev.current = state;
  }, [state, sessionId, navigate]);

  // Apply the glass transparency pref as a :root CSS var so every liquid-glass
  // surface (shell + the recording widget) reacts live. Runs even while
  // recording — these hooks execute before the in-session early return below.
  useEffect(() => {
    document.documentElement.style.setProperty('--glass-alpha', String(glassOpacity));
  }, [glassOpacity]);

  // Sync the close-to-tray pref to the backend (it's enforced in Rust on the
  // window-close event) — on mount and whenever the setting changes. Fails
  // silently outside a Tauri webview (plain `vite dev`).
  useEffect(() => {
    setCloseToTray(closeToTray).catch(() => {});
  }, [closeToTray]);

  // (Un)register the global start/stop shortcut to match the pref — on mount
  // and whenever it changes (the backend registers the default-on state early;
  // this re-syncs the persisted choice).
  useEffect(() => {
    setGlobalShortcutEnabled(globalShortcutEnabled).catch(() => {});
  }, [globalShortcutEnabled]);

  // Global hotkey / tray toggle → start or stop a session. Mounted once; the
  // handler reads the live session state itself, so no stale closures.
  useEffect(() => {
    const unlisten = onRecordingToggle(() => void handleRecordingToggle());
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  // Check GitHub Releases for a newer version once, shortly after launch. Silent:
  // failures (offline, or plain `vite dev` outside Tauri) stay invisible; an
  // available update surfaces as the <UpdateBanner/> below.
  useEffect(() => {
    void checkOnLaunch();
  }, []);

  // While a session is active the whole window becomes the floating
  // transcription widget (its own root, no titlebar/sidebar). The floating
  // widget is intentionally compact and not affected by the UI zoom.
  if (inSession) return <RecordingView />;

  return (
    // UI font size = CSS zoom on the shell. Counter-scale the shell to the
    // viewport (calc(100vw / N) × calc(100vh / N)) so zooming enlarges the
    // content but the shell still renders back to exactly the window size —
    // no overflow/clipping; the inner scroll areas handle the extra height.
    <div
      className="flex flex-col gap-2"
      style={{
        zoom: uiScale,
        width: `calc(100vw / ${uiScale})`,
        height: `calc(100vh / ${uiScale})`,
      }}
    >
      <Titlebar />
      <UpdateBanner />
      <div className="flex min-h-0 flex-1 gap-2">
        <SessionSidebar />
        <main className="liquid-glass min-w-0 flex-1 overflow-y-auto rounded-lg">
          <Routes>
            <Route index element={<LibraryRoute />} />
            <Route path="settings" element={<SettingsRoute />} />
            <Route path="search" element={<SearchRoute />} />
            <Route path="about" element={<AboutRoute />} />
            <Route path="session/:id" element={<SessionDetailRoute />} />
          </Routes>
        </main>
        {detailSessionId !== null && !Number.isNaN(detailSessionId) && (
          <ChatPanel key={detailSessionId} sessionId={detailSessionId} />
        )}
      </div>
    </div>
  );
}
