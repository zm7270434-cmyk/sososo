# UI: kaca transparan (hapus efek blur)

- **Tanggal:** 2026-06-06

## Tujuan

Koreksi user: yang diinginkan sejak awal adalah **kaca transparan**, *bukan*
frosted/blur. Desain lama memakai dua lapis blur — native acrylic
(window-vibrancy) + CSS `backdrop-filter: blur()` — yang membuat tampilan buram.

## Perubahan

Membuang **semua** sumber blur dan menggantinya dengan transparansi tajam; tint
"kaca" kini sepenuhnya dari alpha background panel (CSS), bukan dari blur.

### Backend (Rust)
- `src-tauri/src/lib.rs` — hapus `use window_vibrancy::apply_acrylic` dan blok
  `apply_acrylic(...)` untuk overlay + main. Window tetap `transparent: true`
  (tanpa acrylic) → desktop di belakang tampil **tajam/tembus pandang**.
- `src-tauri/Cargo.toml` — hapus dependensi `window-vibrancy` (tak terpakai lagi).

### Frontend (CSS)
- `src/styles/glass.css` — hapus `backdrop-filter: blur()` +
  `-webkit-backdrop-filter`. Sisakan background tint + border + highlight +
  drop-shadow (efek "tepi kaca" tanpa blur konten).
- `src/styles/theme.css` — naikkan alpha tint agar teks tetap terbaca tanpa
  bantuan blur: `--glass-bg` `0.45 → 0.58`, `--glass-bg-strong` `0.62 → 0.74`.
  Hapus variabel `--blur` (tak terpakai).
- `src/styles/reset.css` — perbarui komentar (transparan untuk celah antar panel,
  bukan untuk acrylic).

### Dokumentasi
- `CLAUDE.md` — bagian arsitektur "Two windows" diperbarui: glass = transparan
  tanpa acrylic/vibrancy, tint dari `--glass-bg`.

## Catatan
- Tampilan kini: panel kaca semi-transparan mengambang, desktop di belakang
  terlihat **tajam** (tidak buram), dengan celah transparan antar panel.
- Jika user ingin lebih/kurang transparan, cukup ubah alpha `--glass-bg` /
  `--glass-bg-strong` di `src/styles/theme.css`.

## Verifikasi
- `bun run build` — **OK**.
- `cargo check` — **OK** (2.3s; tidak ada referensi `window-vibrancy` tersisa).
- **Visual** belum diuji headless — jalankan `bun run tauri dev` untuk konfirmasi.
