import { useEffect, useState } from "react";
import {
  hasApiKey,
  listDevices,
  setApiKey,
  setDevices,
} from "../../../lib/ipc";
import type { DeviceLists } from "../../../types/domain";

export default function SettingsRoute() {
  const [devices, setDeviceLists] = useState<DeviceLists | null>(null);
  const [inputId, setInputId] = useState("");
  const [outputId, setOutputId] = useState("");
  const [dgKey, setDgKey] = useState("");
  const [oaKey, setOaKey] = useState("");
  const [dgSaved, setDgSaved] = useState(false);
  const [oaSaved, setOaSaved] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    listDevices()
      .then((d) => {
        setDeviceLists(d);
        setInputId(d.input.find((x) => x.isDefault)?.id ?? d.input[0]?.id ?? "");
        setOutputId(
          d.output.find((x) => x.isDefault)?.id ?? d.output[0]?.id ?? "",
        );
      })
      .catch((e) => setStatus(`Gagal memuat device: ${e}`));
    hasApiKey("deepgram").then(setDgSaved).catch(() => {});
    hasApiKey("openai").then(setOaSaved).catch(() => {});
  }, []);

  async function saveDevices() {
    try {
      await setDevices(inputId || null, outputId || null);
      setStatus("Device tersimpan.");
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  async function saveKey(service: "deepgram" | "openai") {
    const value = (service === "deepgram" ? dgKey : oaKey).trim();
    if (!value) return;
    try {
      await setApiKey(service, value);
      if (service === "deepgram") {
        setDgKey("");
        setDgSaved(true);
      } else {
        setOaKey("");
        setOaSaved(true);
      }
      setStatus(`${service} API key tersimpan.`);
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  return (
    <div className="settings">
      <h2>Settings</h2>

      <section className="settings-group">
        <h3>API Keys</h3>
        <label className="field">
          <span>
            Deepgram API Key{" "}
            {dgSaved && <em className="saved">✓ tersimpan</em>}
          </span>
          <div className="field-row">
            <input
              type="password"
              value={dgKey}
              onChange={(e) => setDgKey(e.target.value)}
              placeholder={dgSaved ? "••••••••••••" : "Token Deepgram…"}
            />
            <button onClick={() => void saveKey("deepgram")}>Simpan</button>
          </div>
        </label>
        <label className="field">
          <span>
            OpenAI API Key {oaSaved && <em className="saved">✓ tersimpan</em>}
          </span>
          <div className="field-row">
            <input
              type="password"
              value={oaKey}
              onChange={(e) => setOaKey(e.target.value)}
              placeholder={oaSaved ? "••••••••••••" : "sk-…"}
            />
            <button onClick={() => void saveKey("openai")}>Simpan</button>
          </div>
        </label>
        <p className="muted">
          Key disimpan aman di Windows Credential Manager dan tidak pernah
          dikirim ke frontend.
        </p>
      </section>

      <section className="settings-group">
        <h3>Audio Devices</h3>
        <label className="field">
          <span>Mikrofon</span>
          <select value={inputId} onChange={(e) => setInputId(e.target.value)}>
            {devices?.input.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Sumber system audio (output yang di-loopback)</span>
          <select
            value={outputId}
            onChange={(e) => setOutputId(e.target.value)}
          >
            {devices?.output.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" onClick={() => void saveDevices()}>
          Simpan device
        </button>
      </section>

      <section className="settings-group">
        <h3>Bahasa</h3>
        <p className="muted">
          Semua bahasa kini memakai model <b>Nova-3</b> Deepgram (akurasi terbaik,
          termasuk Bahasa Indonesia). Pilih bahasa di layar utama sebelum mulai
          merekam. Opsi <i>Auto-deteksi (multilingual)</i> mengenali campuran
          beberapa bahasa otomatis, tetapi memilih satu bahasa spesifik biasanya
          lebih akurat.
        </p>
      </section>

      {status && <p className="status">{status}</p>}
    </div>
  );
}
