import next from "@next/eslint-plugin-next";

/**
 * Flat ESLint config.
 *
 * TOOLCHAIN NOTE (TypeScript 7.0):
 *   `eslint-config-next` and `typescript-eslint` do not yet support the
 *   TypeScript 7.0 compiler API — importing them throws at load
 *   (typescript-eslint issue #10940, "support for TS >= 7.1"). This project is
 *   pinned to TypeScript 7.0.2, so we wire up the official Next.js ESLint
 *   plugin directly instead of going through `eslint-config-next`.
 *
 *   Type-aware linting is therefore provided by the TypeScript compiler itself
 *   via `npm run typecheck` (tsc --noEmit), which is the authoritative static
 *   analysis gate for the .ts/.tsx sources. ESLint here enforces Next.js's
 *   framework rules (Core Web Vitals) on the JavaScript config surface. When
 *   typescript-eslint ships TS 7 support, add its parser + recommended config
 *   back here and widen `files` to include ts/tsx.
 */
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
  {
    // Lint the JS/MJS surface (config files) with Next's framework rules.
    // .ts/.tsx are checked by tsc (see note above) until a TS7-compatible
    // ESLint parser is available.
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { "@next/next": next },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
    },
  },
];

export default eslintConfig;
