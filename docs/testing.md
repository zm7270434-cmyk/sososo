# Testing & coverage

TDD is mandatory (see [`CLAUDE.md`](../CLAUDE.md)). This is the quick reference for
running the suites and coverage locally; CI runs all of them on every push/PR.

## Run the tests

| Suite                 | Command                                           |
| --------------------- | ------------------------------------------------- |
| Frontend (`bun:test`) | `bun test`                                        |
| Frontend coverage     | `bun run coverage` (`bun test --coverage`)        |
| Rust backend          | `cargo test --manifest-path src-tauri/Cargo.toml` |

Frontend tests live beside the unit under test as `*.test.ts(x)` and run on Bun's
built-in runner. Rust tests are inline `#[cfg(test)] mod tests` (or, for the data
layer, `src-tauri/src/db/tests.rs`).

## Rust coverage (optional)

`cargo-llvm-cov` produces line coverage for the backend. One-time setup:

```bash
rustup component add llvm-tools-preview
cargo install cargo-llvm-cov
```

Then, from the repo root:

```bash
cargo llvm-cov --manifest-path src-tauri/Cargo.toml         # summary table
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --html  # browsable HTML report
```

## Other verification gates (CI + local)

- `bun run build` — TypeScript typecheck + Vite production build.
- `bun run lint` — ESLint (flat config; `eslint.config.js`).
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `bun run format:check`.
- **Security audits:** `bun audit` (JS) and `cargo audit` (Rust, RustSec) run in the
  `Security audit` CI job.

## Commit messages

Commits follow [Conventional Commits]; CI lints them via
`wagoid/commitlint-github-action` (config: `commitlint.config.js`). Check locally with
`bunx commitlint --from=HEAD~1`.

[Conventional Commits]: https://www.conventionalcommits.org/
