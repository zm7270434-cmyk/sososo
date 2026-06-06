# Nova-3 untuk semua bahasa + fitur riwayat (SQLite)

- **Tanggal:** 2026-06-05
- **Milestone:** menutup **D (persistence/SQLite)** + perluasan bahasa STT.

## Tujuan

1. Menambah varian bahasa yang didukung Deepgram **Nova-3** dan memindahkan
   **semua** bahasa ke Nova-3 (sebelumnya hanya `multi`/`en` di Nova-3, sisanya
   Nova-2).
2. Mengimplementasikan **fitur riwayat** yang sebelumnya hanya placeholder statis
   (`SAMPLE_SESSIONS`) — simpan sesi + transkrip, daftar nyata, buka & baca
   transkrip lama, hapus, dan ganti nama.

## Riset (terverifikasi 2 sumber)

- Nova-3 kini mendukung **Indonesian (`id`) streaming** (Deepgram, Jan 2026),
  dengan WER lebih rendah dibanding Nova-2 → memindahkan `id` ke Nova-3 menaikkan
  akurasi.
- Nova-3 mendukung ~50+ bahasa + mode `multi` (code-switching). Daftar mengacu
  ke Models & Languages Overview Deepgram.
- SDK Rust `deepgram 0.10`: `Model::Nova3` + `Language::Other(String)` (escape
  hatch) → semua kode BCP-47 dipetakan seragam ke Nova-3.

## Perubahan

### Bahasa (semua Nova-3)
- `src/lib/languages.ts` **(baru)** — daftar lengkap bahasa Nova-3 (label Bahasa
  Indonesia, termasuk varian regional), `multi`+`id` disematkan di atas; helper
  `languageLabel()`.
- `src/state/configStore.ts` — `LanguageCode` jadi `string` (daftar dinamis).
- `src/windows/main/routes/LibraryRoute.tsx` — dropdown bahasa render dari `LANGUAGES`.
- `src/windows/main/routes/SettingsRoute.tsx` — teks bagian Bahasa diperbarui (semua Nova-3).
- `src-tauri/src/session.rs` — `model_language()` selalu `Model::Nova3`.

### Riwayat (SQLite, Milestone D)
- `src-tauri/Cargo.toml` — tambah `rusqlite` (fitur `bundled`).
- `src-tauri/src/error.rs` — varian `AppError::Db` + `From<rusqlite::Error>`.
- `src-tauri/src/db.rs` **(baru)** — `Db(Mutex<Connection>)`, skema `sessions` +
  `segments` (FK cascade, WAL), tipe serde (`SessionSummary`, `StoredSegment`,
  `SessionDetail`), dan operasi: `create_session`, `finalize_session` (set
  `ended_at` atau buang sesi kosong), `upsert_segment`, `list_sessions`,
  `get_session`, `delete_session`, `rename_session`.
- `src-tauri/src/lib.rs` — `mod db`, buka DB di `app_data_dir()/sososo.db` pada
  `setup()` + `app.manage(db)`, registrasi 4 command baru.
- `src-tauri/src/commands.rs` — `start_session` insert baris sesi (judul default
  `Rekaman dd-mm-YYYY HH:MM`) & kembalikan id dari DB; command baru `list_sessions`,
  `get_session`, `delete_session`, `rename_session`.
- `src-tauri/src/session.rs` — `spawn_session` menerima `session_id` (hapus
  `NEXT_ID` atomic, id kini dari DB); `emit_transcript` menyimpan segmen **final**
  (idempotent); teardown memanggil `finalize_session`.
- Frontend: `src/types/domain.ts` (tipe baru), `src/lib/ipc.ts` (4 wrapper),
  `src/lib/format.ts` **(baru, locale id-ID)**, `src/windows/main/SessionSidebar.tsx`
  (daftar nyata + refresh saat sesi berhenti + tombol "Rekaman baru"),
  `src/windows/main/routes/SessionDetailRoute.tsx` **(baru)** (baca transkrip +
  ganti nama inline + hapus dua langkah), `src/windows/main/MainApp.tsx` (route
  `session/:id`), `src/windows/main/main.css` (styling).

## Catatan desain

- **Persistence pakai `rusqlite` (sinkron)**, bukan `tauri-plugin-sql`/`sqlx`:
  segmen dihasilkan di backend (`run_session`), jadi penulisan dari Rust paling
  natural. Tulis hanya saat segmen `is_final` (interim di-upsert di memori saja).
- **id sesi kini dari DB** (`AUTOINCREMENT`), bukan counter in-memory yang reset
  tiap restart — mencegah tabrakan id antar sesi aplikasi.
- **Sesi kosong dibuang** otomatis saat teardown/gagal agar riwayat bersih.
- Custom command tidak butuh entry capability baru di Tauri 2; `app.state::<Db>()`
  aman karena DB di-`manage` saat `setup()` sebelum command apa pun bisa dipanggil.

## Verifikasi

- `bun run build` (tsc strict + Vite) — **OK**.
- `cargo check` — **OK**.
- `cargo clippy` — kode baru tanpa warning (2 warning pre-existing di
  `audio/mixer.rs`, di luar scope).

## Belum dikerjakan / lanjutan

- Input judul saat mulai rekaman (sekarang judul default + bisa di-rename).
- Beberapa bahasa Nova-3 mungkin batch-only; jika kode tertentu ditolak API saat
  streaming, error sudah ditampilkan di UI (tidak crash).
- Milestone E (ringkasan AI / OpenAI) masih placeholder.
