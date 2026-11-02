// @ts-check
import { defineConfig } from "eslint/config";
import { includeIgnoreFile } from "@eslint/compat";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import path from "node:path";
import globals from "globals";
import eslintReact from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import unicorn from "eslint-plugin-unicorn";
import sonarjs from "eslint-plugin-sonarjs";

// The Menus screen (React 18 UI extension). The Sonar block is the views module's, kept alike: the
// SonarQube rules that keep failing the pull-request gate, checked by `yarn lint` first.
export default defineConfig(
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  eslint.configs.recommended,
  { files: ["**/*.ts", "**/*.tsx"], extends: tseslint.configs.recommended },
  { files: ["src/javascript/**/*.tsx"], extends: [eslintReact.configs["recommended-typescript"]] },
  { files: ["src/javascript/**/*.tsx", "src/javascript/**/*.ts"], plugins: { "react-hooks": reactHooks }, rules: reactHooks.configs.recommended.rules },

  {
    files: ["src/javascript/**/*.ts", "src/javascript/**/*.tsx"],
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

  // Build output, Maven's Node and the config files themselves
  { ignores: ["src/main/resources/javascript/apps/**", "node/**", "target/**", "*.config.js", "*.config.mjs", "babel.config.js"] },
  includeIgnoreFile(path.resolve(import.meta.dirname, "../.gitignore")),
);
