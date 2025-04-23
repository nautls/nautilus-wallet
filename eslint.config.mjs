import jsPlugin from "@eslint/js";
import vueI18nPlugin from "@intlify/eslint-plugin-vue-i18n";
import tsParser from "@typescript-eslint/parser";
import vuePlugin from "eslint-plugin-vue";
import tsPlugin from "typescript-eslint";
import vueParser from "vue-eslint-parser";

export default [
  {
    ignores: [
      "**/node_modules",
      "**/dist",
      "**/coverage",
      "**/docs",
      "src/components/ui",
      "**/*.json"
    ]
  },
  jsPlugin.configs.recommended,
  ...tsPlugin.configs.recommended,
  ...vueI18nPlugin.configs.recommended,
  ...vuePlugin.configs["flat/essential"],

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

    settings: {
      "vue-i18n": {
        localeDir: "./src/i18n/locales/*.json",
        messageSyntaxVersion: "^11.1.2"
      }
    },

    rules: {
      "no-console": "error",
      "no-undef": "off", // TypeScript's compiler already enforces this check. https://eslint.org/docs/latest/rules/no-undef#handled_by_typescript
      "sort-imports": "off",

      "@typescript-eslint/explicit-module-boundary-types": "off",

      "vue/component-api-style": ["warn", ["script-setup", "composition"]],
      "vue/multi-word-component-names": "off",

      "@intlify/vue-i18n/no-missing-keys": "error",
      "@intlify/vue-i18n/no-raw-text": "warn",
      "@intlify/vue-i18n/no-unused-keys": "off",
      "@intlify/vue-i18n/no-deprecated-i18n-component": "off",
      "@intlify/vue-i18n/no-deprecated-i18n-place-attr": "off",
      "@intlify/vue-i18n/no-deprecated-i18n-places-prop": "off",
      "@intlify/vue-i18n/no-deprecated-modulo-syntax": "off",
      "@intlify/vue-i18n/no-deprecated-tc": "off",
      "@intlify/vue-i18n/no-deprecated-v-t": "off",
      "@intlify/vue-i18n/no-html-messages": "off",
      "@intlify/vue-i18n/no-i18n-t-path-prop": "off",
      "@intlify/vue-i18n/no-v-html": "off",
      "@intlify/vue-i18n/valid-message-syntax": "off"
    }
  }
];
