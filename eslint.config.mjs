// @ts-check

import jsPlugin from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import vuePlugin from "eslint-plugin-vue";
import tsPlugin from "typescript-eslint";
import vueParser from "vue-eslint-parser";

export default [
  {
    ignores: ["**/node_modules", "**/dist", "**/coverage", "**/docs", "src/components/ui"]
  },
  ...tsPlugin.configs.recommended,
  ...vuePlugin.configs["flat/essential"],
  jsPlugin.configs.recommended,
  {
    languageOptions: {
      globals: {
        BigInt: true,
        console: true,
        WebAssembly: true,
        chrome: true,
        process: true
      },

      parser: vueParser,
      ecmaVersion: "latest",
      sourceType: "module",

      parserOptions: { parser: tsParser }
    },

    rules: {
      "vue/component-api-style": ["warn", ["script-setup", "composition"]],
      "vue/multi-word-component-names": "off",
      "no-console": "error",
      "no-undef": "off", // TypeScript's compiler already enforces this check. https://eslint.org/docs/latest/rules/no-undef#handled_by_typescript
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "sort-imports": "off"
    }
  }
];
