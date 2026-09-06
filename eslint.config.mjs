import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * This config exists because of exactly one crash.
 *
 * A `useEffect` placed below an early return took the whole Shop tab down
 * for every player — "Rendered more hooks than during the previous render"
 * — and `tsc --noEmit`, `next build` AND the mobile audit all reported
 * clean. None of them knows the rules of hooks, and there was no ESLint
 * config in this repo at all, so the rule that catches it instantly had
 * never run here.
 *
 * Deliberately narrow: this is a correctness gate, not a style pass. Adding
 * a hundred cosmetic rules to a codebase that has never been linted would
 * bury the one rule that matters under noise nobody would read.
 *
 * `react-hooks/rules-of-hooks` is an ERROR and must stay one.
 */
export default [
  { ignores: [".next/**", "node_modules/**", "public/sw.js", "supabase/**"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
