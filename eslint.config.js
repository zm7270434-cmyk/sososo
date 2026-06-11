import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Generated / vendored output — never linted.
  { ignores: ['dist', 'src-tauri', 'public', 'node_modules', 'website/dist'] },

  // Base + TypeScript recommended rules for all source.
  js.configs.recommended,
  tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // React Compiler-era rules (react-hooks v7). They fire on patterns that are
      // legitimate in this (non-compiler) codebase — "reset state when a dependency
      // changes" effects in the large route components, and a render-time Date.now()
      // in the elapsed-time hook. Kept visible as warnings to be fixed properly
      // (with tests) when those units are touched in later phases, rather than as
      // hard errors that would force risky rewrites now.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },

  // Node-context config files.
  {
    files: ['vite.config.ts', '**/*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },

  // Test files run under Bun's test runner.
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
);
