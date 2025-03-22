// @ts-check

import jsPlugin from "@eslint/js";
import vueI18n from "@intlify/eslint-plugin-vue-i18n";
import tsParser from "@typescript-eslint/parser";
import vuePlugin from "eslint-plugin-vue";
import tsPlugin from "typescript-eslint";
import vueParser from "vue-eslint-parser";

export default [
  {
    ignores: ["**/node_modules", "**/dist", "**/coverage", "**/docs", "src/components/ui"]
  },
  ...vueI18n.configs.recommended,
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
      "sort-imports": "off",
      "@intlify/vue-i18n/no-deprecated-i18n-component": "off"
    },

    settings: {
      "vue-i18n": {
        localeDir: "src/locales/*.json",
        // Specify the version of `vue-i18n` you are using.
        // If not specified, the message will be parsed twice.
        messageSyntaxVersion: "^11.0.0"
      }
    }
  }
];
