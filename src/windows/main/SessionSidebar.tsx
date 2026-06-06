import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { listSessions } from "../../lib/ipc";
import { useSessionStore } from "../../state/sessionStore";
import { formatDateTime } from "../../lib/format";
import type { SessionSummary } from "../../types/domain";

export default function SessionSidebar() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const state = useSessionStore((s) => s.state);

  // Load on mount and refresh whenever a session ends, so a just-finished
  // recording shows up immediately. Skip while recording (the list won't change).
  useEffect(() => {
    if (state === "recording" || state === "starting") return;
    listSessions()
      .then(setSessions)
      .catch(() => {});
  }, [state]);

  return (
    <aside className="sidebar glass">
      <NavLink to="/main" end className="new-session-btn">
        ＋ Rekaman baru
      </NavLink>
      <div className="sidebar-head">Riwayat</div>
      <nav className="session-list">
        {sessions.length === 0 ? (
          <p className="session-empty">Belum ada rekaman tersimpan.</p>
        ) : (
          sessions.map((s) => (
            <NavLink
              key={s.id}
              to={`/main/session/${s.id}`}
              className="session-item"
              title={s.title}
            >
              <span className="session-title">{s.title}</span>
              <span className="session-time">
                {formatDateTime(s.startedAt)} · {s.segmentCount} baris
              </span>
            </NavLink>
          ))
        )}
      </nav>
      <NavLink to="/main/settings" className="settings-btn">
        ⚙ Settings
      </NavLink>
    </aside>
  );
}
