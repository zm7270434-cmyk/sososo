import { closeSelf, minimizeSelf } from "../../lib/window";

export default function Titlebar() {
  return (
    <header className="titlebar glass-strong" data-tauri-drag-region>
      <div className="brand">
        <span className="brand-dot" />
        sososo
      </div>
      <span className="spacer" />
      <button
        className="icon-btn"
        title="Minimize"
        onClick={() => void minimizeSelf()}
      >
        —
      </button>
      <button
        className="icon-btn danger"
        title="Tutup"
        onClick={() => void closeSelf()}
      >
        ✕
      </button>
    </header>
  );
}
