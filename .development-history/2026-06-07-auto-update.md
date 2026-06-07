# Auto-update (Tauri updater)

**Goal:** Let the app update itself in-app from GitHub Releases instead of users
manually re-downloading installers.

## Approach

Frontend-driven via the updater JS plugin (mirrors `AboutRoute` calling
`getVersion()` directly). Rust only registers the plugins.

- Check once at launch (silent) + manual button in Settings.
- Available update → banner under the titlebar → Download & install (progress) →
  Restart now.

## Key changes

- **Deps:** `tauri-plugin-updater`, `tauri-plugin-process` (Cargo);
  `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process` (package.json).
- **Rust:** `src-tauri/src/lib.rs` registers `process` + `updater` plugins.
- **Config:** `tauri.conf.json` → `bundle.createUpdaterArtifacts: true` +
  `plugins.updater { pubkey, endpoints: [.../releases/latest/download/latest.json] }`.
- **Capabilities:** `main.json` += `updater:default`, `process:allow-restart`.
- **Frontend:** new `state/updateStore.ts` (status machine), `lib/updater.ts`
  (`check`/`downloadAndInstall`/`relaunch` wrappers + once-per-launch guard),
  `windows/main/UpdateBanner.tsx`; `MainApp` runs the launch check + renders the
  banner; `SettingsRoute` gets an "App update" section (version + check + status).
  `lib/icons.ts` += `IconDownload`.
- **Release:** `release.yml` passes `TAURI_SIGNING_PRIVATE_KEY(_PASSWORD)` to
  `tauri-action`, which then emits signed artifacts + a merged `latest.json`.

## Decisions

- Frontend-driven (not custom Rust commands): minimal Rust, matches existing
  direct-plugin-usage pattern; progress comes from the `downloadAndInstall`
  callback, so no new event bus.
- Silent launch check stays quiet on failure (offline / non-Tauri) → no error
  banner; manual check surfaces errors.
- Updater signing keypair (minisign) generated; public key committed in config,
  private key + password set as GitHub secrets (`gh secret set`). Backup at
  `~/.tauri/sososo.key*` (never committed).

## Rollout caveat

Auto-update only applies to releases published **after** this shipped. 0.5.0 has
no updater, so the first updater build (**0.6.0**) is a one-time manual download;
0.6.0 → 0.7.0+ is in-app. Updatable targets: NSIS / `.app` / AppImage only.
OS code signing (Authenticode / notarization) still out of scope.

## Verification

- `bun run build` ✓ · `cargo check` ✓ · `cargo clippy` ✓ (only pre-existing
  `mixer.rs` warnings, untouched) · prettier + rustfmt ✓.
- E2E updater needs two signed releases — verify manually after publishing 0.6.0.
