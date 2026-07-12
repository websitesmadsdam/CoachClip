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
    rules: {
      "no-unused-vars": "off"
    }
  }
];
