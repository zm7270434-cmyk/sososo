# Satu window + tampilan transkripsi (Jeda & Selesai), hapus overlay

- **Tanggal:** 2026-06-06

## Masalah & permintaan

1. **Bug:** window transkripsi (overlay melayang) jika ditutup tidak bisa dibuka
   lagi (window dihancurkan, tak ada cara membuat ulang).
2. **Perubahan UX:** jadikan **satu window** — saat mulai, window berubah jadi
   tampilan transkripsi, dengan tombol **Jeda (pause)** dan **Selesai** di atas.

## Solusi

Menghapus overlay sepenuhnya (sekaligus menghilangkan bug) dan menjadikan aplikasi
**single-window** yang *state-driven*: saat sesi aktif, window otomatis menampilkan
`RecordingView` (transkrip langsung + bar Jeda/Selesai); saat idle, tampil layout
biasa (titlebar + sidebar riwayat + rute library/settings/detail).

### Backend (Rust)
- **Pause** (`session.rs` + `state.rs` + `commands.rs`):
  - `ActiveSession` kini menyimpan `paused: Arc<AtomicBool>`.
  - Bridge audio membaca flag tiap tick: saat pause, sampel dibuang dan **tidak**
    dikirim ke Deepgram — WS tetap hidup via `.keep_alive()` SDK; saat resume,
    audio diteruskan lagi. (Pause = transkripsi berhenti tanpa memutus koneksi.)
  - Command baru `set_paused(paused: bool)`.
- **Hapus overlay** (`lib.rs`): tidak ada lagi pembuatan window `overlay` di
  `setup()`; command `focus_overlay` dihapus; import `WebviewWindowBuilder`/
  `WebviewUrl`/`PhysicalPosition`/`Manager`(commands) dibersihkan.
- `capabilities/overlay.json` dihapus.

### Frontend (TypeScript)
- **Hapus** folder `src/windows/overlay/` (OverlayApp, RecBar, LiveCaptions,
  QuickNoteInput, overlay.css).
- `AppRouter.tsx` — hanya rute `/main/*` (rute `/overlay` dihapus).
- `MainApp.tsx` — render kondisional: `inSession` (starting/recording/stopping/
  reconnecting) → `RecordingView` penuh; selain itu layout normal. Saat sesi
  berakhir (`stopped`), navigasi ke detail sesi bila ada transkrip final, jika
  tidak kembali ke beranda.
- `RecordingView.tsx` **(baru)** — bar atas (status + timer + **Jeda/Lanjutkan** +
  **Selesai**) dan daftar caption live (auto-scroll).
- `sessionStore.ts` — tambah `paused`, `pausedAt`, `pausedTotalMs`, aksi
  `setPaused` (akuntansi waktu jeda).
- `useElapsedTimer.ts` — timer mengecualikan waktu jeda dan beku saat dijeda.
- `useSession.ts` — tambah `paused` + `togglePause` (optimistic + revert bila
  command gagal).
- `useTranscriptStream.ts` — reset akuntansi pause di awal/akhir sesi.
- `ipc.ts` — `setPaused` (ganti `focusOverlay` yang dihapus).
- `LibraryRoute.tsx` — buang `focusOverlay`/cabang overlay; teks tip diperbarui.
- `main.css` — gaya `RecordingView` + caption (port dari overlay.css).

### Dokumentasi
- `CLAUDE.md` — bagian arsitektur ditulis ulang jadi "One window, state-driven
  views"; intro, capabilities, dan roadmap milestone (D & E selesai) diperbarui.

## Alur baru
Beranda → **Mulai Transkripsi** → window jadi tampilan transkripsi (Jeda/Selesai
di atas) → **Selesai** → berhenti + buka **detail sesi** (tempat tombol ringkasan
AI). Tidak ada lagi window terpisah yang bisa "hilang".

## Catatan
- `window-vibrancy` masih ada di `Cargo.lock` sebagai dependensi **transitif milik
  `tauri`** — bukan dipakai kode kita (tidak ada `apply_acrylic`), jadi tetap tanpa
  blur.
- Pause memanfaatkan keep-alive Deepgram, jadi jeda lama pun koneksi tetap hidup.

## Verifikasi
- `bun run build` (tsc strict + Vite) — **OK** (72 modul; 4 file overlay terhapus).
- `cargo check` — **OK** (3.95s).
- `cargo clippy` — kode baru tanpa warning (2 warning pre-existing di
  `audio/mixer.rs`, di luar scope).
- **Runtime/visual** belum diuji headless — jalankan `bun run tauri dev`.
