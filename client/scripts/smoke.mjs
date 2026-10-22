/**
 * Bundles and runs the Phase 2 client smoke test (scripts/smoke-entry.jsx) in
 * Node. Uses esbuild (already shipped with Vite) so TSX/JSX can execute without
 * a browser. Forces DEMO catalog mode so the run is deterministic and offline.
 */
import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const OUT = fileURLToPath(new URL('./.smoke-bundle.mjs', import.meta.url));

try {
  await build({
    entryPoints: ['scripts/smoke-entry.jsx'],
    outfile: OUT,
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    loader: { '.js': 'jsx' },
    define: {
      'import.meta.env.VITE_CATALOG_MODE': '"demo"',
      'import.meta.env.VITE_API_BASE_URL': 'undefined',
    },
    banner: {
      js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
    },
    logLevel: 'warning',
  });
  await import(`${pathToFileURL(OUT).href}?t=${Date.now()}`);
} finally {
  try {
    rmSync(OUT, { force: true });
  } catch {
    /* ignore cleanup errors */
  }
}
