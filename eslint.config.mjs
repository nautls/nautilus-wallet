import { fileURLToPath } from "node:url";
import path from "node:path";
import { fixupConfigRules } from "@eslint/compat";
import parser from "vue-eslint-parser";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  {
    ignores: ["**/node_modules", "**/dist", "**/coverage"]
  },
  ...fixupConfigRules(
    compat.extends(
      "eslint:recommended",
      "plugin:vue/vue3-recommended",
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
      "no-console": "error",
      "@typescript-eslint/explicit-module-boundary-types": "off",

      "sort-imports": [
        "warn",
        {
          ignoreDeclarationSort: true,
          ignoreCase: true
        }
      ],

      "import/order": "warn",
      "import/default": "off",
      "import/no-named-as-default-member": "off",
      "import/no-unresolved": "off"
    }
  }
];
