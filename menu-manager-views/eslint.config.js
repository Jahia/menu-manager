// @ts-check
import { defineConfig } from "eslint/config";
import { includeIgnoreFile } from "@eslint/compat";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import path from "node:path";
import globals from "globals";
import eslintReact from "@eslint-react/eslint-plugin";
import unicorn from "eslint-plugin-unicorn";
import sonarjs from "eslint-plugin-sonarjs";

export default defineConfig(
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // JS/TS recommended
  eslint.configs.recommended,
  { files: ["**/*.ts", "**/*.tsx"], extends: tseslint.configs.recommended },

  // React
  eslintReact.configs["recommended-typescript"],

  // The SonarQube rules that keep failing the pull-request gate, checked here first so that
  // `yarn lint` (and the "Static checks" job) fails before Sonar does. Sonar rule in each comment;
  // the list and how to write each case: .agents/context/sonar-rules.md. Keep both packages alike.
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { unicorn, sonarjs },
    rules: {
      "@typescript-eslint/require-array-sort-compare": ["error", { ignoreStringArrays: false }], // S2871
      "@typescript-eslint/no-unnecessary-type-assertion": "error", // S4325
      "@typescript-eslint/no-base-to-string": "error", // S6551
      "unicorn/prefer-string-replace-all": "error", // S7781
      "unicorn/prefer-code-point": "error", // S7758
      "unicorn/prefer-string-raw": "error", // S7780
      "unicorn/prefer-at": "error", // S7755
      "unicorn/prefer-export-from": "error", // S7763
      "unicorn/prefer-single-call": "error", // S7778
      "unicorn/prefer-set-has": "error", // S7776
      "unicorn/prefer-global-this": "error", // S7764
      "sonarjs/cognitive-complexity": ["error", 15], // S3776
      "sonarjs/no-nested-conditional": "error", // S3358
      "sonarjs/no-nested-template-literals": "error", // S4624
    },
  },

  // Ignore the same files as .gitignore
  includeIgnoreFile(path.resolve(import.meta.dirname, ".gitignore")),
);
