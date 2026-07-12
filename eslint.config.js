import typescriptParser from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import reactPlugin from "eslint-plugin-react";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "tmp/**",
      "vite.config.ts",
      "eslint.config.js"
    ]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
      "react-hooks": reactHooksPlugin,
      "react": reactPlugin
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "off", // Let's keep warnings as allowed, but restrict raw unneeded logs if needed, or off
      "no-empty": ["error", { "allowEmptyCatch": false }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
];
