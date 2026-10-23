/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { pwa } from "./build/pwa.ts";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

export default defineConfig({
  // Relative base: the same build works at a domain root or under /<repo>/ on GitHub Pages.
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { target: "es2022", sourcemap: false },
  plugins: [pwa()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
