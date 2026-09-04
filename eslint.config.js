// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/next-env.d.ts",
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      // The OCR service is Python; its virtualenv ships JavaScript that
      // belongs to no TypeScript project and cannot be type-checked.
      "**/.venv/**",
      "**/coverage/**",
      "graphify-out/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // ── Type safety: `any` is an error, not a warning ──────────────────────
      // A silently-wrong government figure is this project's worst failure mode
      // (.docs/00-overview/document-audit.md C3), and `any` is how one gets in.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // process.env is an index signature; bracket access is correct there.
      "@typescript-eslint/dot-notation": ["error", { allowIndexSignaturePropertyAccess: true }],

      // ── KISS: keep units small and cohesive ───────────────────────────────
      complexity: ["error", 12],
      "max-depth": ["error", 4],
      "max-params": ["error", 4],

      // Money must never be coerced through a float.
      "no-restricted-globals": [
        "error",
        { name: "parseFloat", message: "Money is bigint paise — use @lokdarpan/money." },
        { name: "parseInt", message: "Use Number.parseInt, or @lokdarpan/money for amounts." },
      ],
    },
  },
  {
    files: ["*.js", "*.ts", "*.mjs", "**/*.config.{js,ts,mjs}"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Tests may assert on malformed input, which requires unsafe shapes.
    files: ["**/*.test.ts", "**/*.test.tsx", "**/tests/**"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
  prettier,
);
