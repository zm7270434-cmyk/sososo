// Enforce Conventional Commits (feat / fix / refactor / chore / docs / test / ci …)
// in CI via wagoid/commitlint-github-action. Run locally with:
//   bunx commitlint --from=HEAD~1
export default { extends: ['@commitlint/config-conventional'] };
