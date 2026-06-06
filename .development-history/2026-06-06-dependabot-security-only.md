# Dependabot: security-only updates

**Goal:** Stop routine version-bump PRs; keep only security-vulnerability PRs.

## Changes

- `.github/dependabot.yml`: set `open-pull-requests-limit: 0` on all three
  ecosystems (cargo `/src-tauri`, npm `/`, github-actions `/`) — the
  GitHub-documented way to disable version updates while still allowing security
  updates. Kept the directories + `commit-message` prefixes; no `target-branch`
  (adding one would disable security-update support).
- Enabled repo settings that were OFF (security-only is meaningless without
  them): Dependabot alerts (`PUT /repos/.../vulnerability-alerts`) + Dependabot
  security updates (`PUT /repos/.../automated-security-fixes`).
- Closed all 6 open version-bump PRs (#1–#6) and deleted their branches:
  - Safe / CI-green, closed under the new policy: #1 `actions/checkout` 4→6,
    #2 `rusqlite` 0.32→0.40, #4 `thiserror` 1→2.
  - Major bump + failed CI: #3 `typescript` 5.8→6.0, #5 `vite` 7→8,
    #6 `@vitejs/plugin-react` 4→6. All three failed at `bun install
--frozen-lockfile` because Dependabot does not regenerate Bun's `bun.lock`.
    #5 + #6 are coupled (plugin-react 6 needs Vite 8).

## Notes

- Dependency graph is on by default for public repos (required for alerts).
- Future dependency upgrades are manual. Major npm bumps must be run locally
  with Bun (it regenerates `bun.lock`) — Dependabot cannot maintain that lockfile.

## Verification

- `gh pr list --state open` → none; no `dependabot/*` branches remain.
- alerts → HTTP 204; automated-security-fixes → `enabled: true`.
