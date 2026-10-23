/**
 * Build-time PWA support, kept small instead of pulling in a plugin:
 *
 * - injects a strict Content-Security-Policy into the built index.html
 *   (dev keeps Vite's defaults because the dev server needs inline scripts);
 * - generates sw.js with a precache list of every emitted file and a cache
 *   name derived from their hashes, so each deploy updates installed apps once.
 *
 * See docs/adr/0003-pwa-instead-of-app-store.md and SECURITY.md.
 */
import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Plugin } from "vite";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Inline style attributes carry per-stage colours; no inline scripts are allowed.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "connect-src 'self' https://api.anthropic.com",
  "img-src 'self' data: blob:",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

export function serviceWorkerSource(cacheName: string, files: string[]): string {
  return `// Generated at build time by build/pwa.ts. Do not edit.
const CACHE = ${JSON.stringify(cacheName)};
const PRECACHE = ${JSON.stringify(["./", ...files])};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Never cache API traffic.
  if (request.method !== "GET" || url.hostname === "api.anthropic.com") return;
  if (request.mode === "navigate") {
    // App shell: network first so updates arrive, cache when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./", copy));
          return response;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }
  const cacheable = url.origin === location.origin || /^fonts\\.(googleapis|gstatic)\\.com$/.test(url.hostname);
  if (!cacheable) return;
  // Hashed assets and fonts never change: cache first.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok || response.type === "opaque") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
`;
}

export function pwa(publicDir = "public"): Plugin {
  return {
    name: "english-year-pwa",
    apply: "build",
    transformIndexHtml(page) {
      // Right after the charset so it applies before any script or stylesheet.
      const charset = '<meta charset="utf-8" />';
      if (!page.includes(charset)) throw new Error("index.html must declare <meta charset>");
      const csp = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`;
      return page.replace(charset, `${charset}\n    ${csp}`);
    },
    generateBundle(_options, bundle) {
      const emitted = Object.keys(bundle).filter((f) => !f.endsWith(".map"));
      const fromPublic = listFiles(publicDir).map((f) =>
        relative(publicDir, f).split(sep).join("/"),
      );
      const files = [...new Set([...emitted, ...fromPublic])].sort();
      const hash = createHash("sha256");
      for (const name of emitted) {
        const chunk = bundle[name]!;
        hash.update(name);
        hash.update(chunk.type === "chunk" ? chunk.code : chunk.source);
      }
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: serviceWorkerSource(`english-year-${hash.digest("hex").slice(0, 12)}`, files),
      });
    },
  };
}
