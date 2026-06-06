# Selesaikan transkrip + ringkasan AI (Milestone E / OpenAI)

- **Tanggal:** 2026-06-06
- **Milestone:** menutup **E (AI summary / OpenAI)**.

## Tujuan

Permintaan user: *"adakan fitur finis transcript dan nantinya summary tergenerate"*
— dikerjakan otonom. Yaitu: sebuah aksi **"Selesaikan transkrip"** pada sesi yang
sudah direkam yang memicu **pembuatan ringkasan AI** dari transkrip tersimpan,
lalu ringkasan ditampilkan dan disimpan.

## Riset (context7, terverifikasi)

- OpenAI **Chat Completions**: `POST https://api.openai.com/v1/chat/completions`,
  body `{ model, messages: [{role, content}], temperature }`, respons
  `choices[].message.content`. Error: `{ error: { message } }`. (Shape stabil.)
- Model default dipilih **`gpt-4o-mini`** — murah, 128k context, tersedia luas,
  cukup kuat untuk ringkasan. Disimpan sebagai konstanta agar mudah diganti.

## Keputusan desain

- **HTTP langsung via `reqwest`**, bukan SDK `async-openai`: `reqwest` sudah ada
  di dependency tree (lewat `deepgram`) memakai **rustls**, jadi dependensi
  tambahan minimal dan risiko mismatch SDK nol. Manifest memakai
  `default-features = false, features = ["json", "rustls"]` agar tidak menarik
  `native-tls`/OpenSSL di Windows. (Catatan: di reqwest 0.13 fitur rustls
  bernama `rustls`, bukan `rustls-tls`.)
- **Trigger manual** (tombol di halaman detail sesi), bukan otomatis saat stop —
  memberi user kontrol atas biaya API. Tombol berlabel
  *"✓ Selesaikan & Buat Ringkasan"*; setelah ada ringkasan, tersedia
  *"↻ Buat ulang"*.
- **Ringkasan selalu Bahasa Indonesia** (konsisten dengan UI), format Markdown
  tetap: `## Ringkasan` / `## Poin Penting` / `## Tindak Lanjut`.
- **Keamanan dijaga**: kunci OpenAI diambil dari Windows Credential Manager
  (`keys::get_api_key("openai")`), tidak pernah ke frontend.
- **Async tanpa menahan lock**: `summarize_session` membaca transkrip (sync) →
  `await` panggilan OpenAI (tanpa MutexGuard ditahan) → simpan hasil (sync),
  sehingga future tetap `Send`.

## Perubahan

### Backend (Rust)
- `src-tauri/Cargo.toml` — tambah `reqwest = { version = "0.13",
  default-features = false, features = ["json", "rustls"] }`.
- `src-tauri/src/error.rs` — varian `AppError::Ai(String)` + `From<reqwest::Error>`.
- `src-tauri/src/ai.rs` **(baru)** — klien OpenAI: `render_transcript()`
  (label `Anda` / `Lawan bicara (pembicara N)`, cap 60k char), `summarize()`
  (bangun prompt, panggil Chat Completions, tangani error 401/non-200, kembalikan
  `(summary, model)`).
- `src-tauri/src/db.rs` — kolom baru `summary`, `summary_model`, `summarized_at`
  di tabel `sessions`; `migrate()` + `table_columns()` untuk menambah kolom pada
  DB lama (SQLite tak punya `ADD COLUMN IF NOT EXISTS`); `SessionSummary`
  diperluas; `row_to_summary` + kedua SELECT (`list_sessions`/`get_session`)
  diperbarui; method `save_summary()`.
- `src-tauri/src/commands.rs` — command async `summarize_session(id)`:
  load transkrip → cek tidak kosong → ambil kunci OpenAI → `ai::summarize` →
  `db.save_summary` → kembalikan teks.
- `src-tauri/src/lib.rs` — `mod ai;` + registrasi `commands::summarize_session`.

### Frontend (TypeScript)
- `src/types/domain.ts` — `SessionSummary` + `summary?`, `summaryModel?`,
  `summarizedAt?`.
- `src/lib/ipc.ts` — wrapper `summarizeSession(id)`.
- `src/windows/main/routes/SessionDetailRoute.tsx` — state `summarizing`,
  `doSummarize()` (panggil command lalu refetch), bagian **"Ringkasan AI"** di
  atas transkrip (empty-state + tombol selesaikan / tampilan ringkasan + meta +
  buat ulang), serta komponen `SummaryView` (renderer Markdown ringan:
  heading/bullet/paragraf, tanpa dependensi tambahan).
- `src/windows/main/main.css` — styling bagian ringkasan.

## Verifikasi

- `bun run build` (tsc strict + Vite) — **OK** (76 modul, exit 0).
- `cargo check` — **OK** (39.6s).
- `cargo clippy` — kode baru tanpa warning (2 warning pre-existing di
  `audio/mixer.rs`, di luar scope).
- **Catatan:** alur runtime (panggilan OpenAI nyata) belum diuji headless —
  butuh GUI + kunci OpenAI + sesi terekam. Jalankan `bun run tauri dev` untuk uji
  end-to-end.

## Belum dikerjakan / lanjutan (opsional)

- Auto-generate ringkasan saat rekaman berhenti (kini manual demi kontrol biaya).
- Indikator "sudah diringkas" (✨) di sidebar riwayat.
- Pilihan model OpenAI di Pengaturan (kini konstanta `gpt-4o-mini`).
- Truncation transkrip sangat panjang kini hard-cut 60k char; bisa diganti
  ringkasan bertahap (map-reduce) bila perlu.
