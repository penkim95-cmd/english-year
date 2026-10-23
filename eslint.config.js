import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // All markup goes through the escaping `html` tag (src/ui/html.ts).
      "no-restricted-properties": [
        "error",
        {
          object: "document",
          property: "write",
          message: "Use the html tag and the renderer instead.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]",
          message: "Render through mount() in src/ui/html.ts so values are escaped.",
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: "Render through mount() in src/ui/html.ts so values are escaped.",
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    // The single place where escaped markup reaches the DOM (tests build fixtures directly).
    files: ["src/ui/html.ts", "tests/**"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    files: ["scripts/**", "build/**", "e2e/**", "*.config.*"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Playwright fixtures must destructure their dependencies, even when there are none.
    files: ["e2e/**"],
    rules: { "no-empty-pattern": "off" },
  },
);
