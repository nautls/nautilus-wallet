import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixupConfigRules } from "@eslint/compat";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import parser from "vue-eslint-parser";

const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  {
    ignores: ["**/node_modules", "**/dist", "**/coverage", "src/components/ui"]
  },
  ...pluginVue.configs["flat/recommended"],
  ...fixupConfigRules(
    compat.extends(
      "eslint:recommended",
      "prettier",
      "plugin:@typescript-eslint/recommended",
      "plugin:import/recommended",
      "plugin:import/typescript"
    )
  ),
  {
    languageOptions: {
      globals: {
        BigInt: true,
        console: true,
        WebAssembly: true,
        chrome: true,
        process: true
      },

      parser: parser,
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        parser: "@typescript-eslint/parser"
      }
    },

    settings: {
      "import/resolver": {
        typescript: true,
        node: true
      }
    },

    rules: {
      "vue/component-api-style": ["warn", ["script-setup", "composition"]],
      "vue/multi-word-component-names": "off",
      "no-console": "error",
      "no-undef": "off", // TypeScript's compiler already enforces this check. https://eslint.org/docs/latest/rules/no-undef#handled_by_typescript
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "sort-imports": "off",
      "import/order": "off",
      "import/default": "off",
      "import/no-named-as-default-member": "off",
      "import/no-unresolved": "off"
    }
  }
];
