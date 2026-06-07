# Build & release

How to produce installers locally, what CI checks, and how a release is cut.

## Building locally

```sh
bun run tauri build
```

This runs `beforeBuildCommand` (`bun run build` — typecheck + Vite build into
`../dist`), then compiles the Rust app and bundles it. Output lands in
`src-tauri/target/release/bundle/`. The bundle is configured in
[`tauri.conf.json`](../src-tauri/tauri.conf.json) (`bundle.targets: "all"`), so
you get your platform's native artifacts:

- **Windows** → NSIS `.exe` and/or MSI installer.
- **macOS** → `.app` and `.dmg` (universal in CI; see below).
- **Linux** → `.deb`, `.AppImage`, and/or `.rpm` (needs the WebKitGTK + libpulse
  dev libraries installed; see [Development](./development.md)).

Bundle metadata: identifier `com.yusup.sososo`, publisher "Yusup Supriyadi",
category "Productivity", icons from `src-tauri/icons/`.

## Continuous integration

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on push/PR to
`master`, on a **matrix of `windows-latest` + `macos-latest` + `ubuntu-latest`**
(cancel-in-progress per ref). Each job:

1. Setup Bun, `bun install --frozen-lockfile`.
2. **Prettier check** — `bun run format:check`.
3. Setup Rust (stable + `rustfmt`, `clippy`) with `Swatinem/rust-cache`.
4. **rustfmt check** — `cargo fmt … -- --check`.
5. **Typecheck + build frontend** — `bun run build` (also produces `../dist`,
   which `tauri::generate_context!` embeds, so it must run before clippy).
6. **Clippy** — `cargo clippy --all-targets`.

> Why all three OSes: the audio backends are `cfg`-gated (WASAPI on Windows, cpal /
> CoreAudio on macOS, libpulse on Linux), so each **only compiles on its own OS**.
> Running clippy on macOS and Linux is how those backends are verified — they can't
> be cross-compiled from Windows. The Linux job first installs the WebKitGTK +
> libpulse dev packages. Keep all three green.

## Cutting a release

[`.github/workflows/release.yml`](../.github/workflows/release.yml) is triggered
by pushing a **`v*` tag** (or manual `workflow_dispatch`):

```sh
git tag v0.2.1
git push origin v0.2.1
```

On the same Windows + macOS + Linux matrix it uses `tauri-apps/tauri-action` to
build and attach artifacts to a **draft GitHub Release** — review it and click
**Publish**.

- macOS builds a **universal** binary (`--target universal-apple-darwin`; the
  workflow adds the `aarch64`/`x86_64` rustup targets) so the `.dmg` runs on both
  Apple Silicon and Intel.
- Linux builds `.deb` / `.AppImage` / `.rpm` on `ubuntu-latest` after installing
  the WebKitGTK + libpulse dev packages.
- `workflow_dispatch` (no tag) builds the artifacts **without** creating a
  release.

> **Code signing is not yet configured.** Builds are unsigned, so first run may
> warn (Windows SmartScreen → "Run anyway"; macOS Gatekeeper → right-click →
> Open). The signing secrets/hooks are stubbed in the workflow env for when
> signing is added.

## Versioning

[Semantic Versioning](https://semver.org/). Keep the version in sync across:

- [`package.json`](../package.json) → `version`
- [`src-tauri/Cargo.toml`](../src-tauri/Cargo.toml) → `package.version`
- [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json) → `version`

Then update [`CHANGELOG.md`](../CHANGELOG.md) (Keep a Changelog format) and tag.

## Related

- [Development](./development.md) — local commands and verification.
- [Platform support](./platform-support.md) — per-OS bundle/runtime specifics.
