// Load-time guard: every module in the static import graph of src/main.js has a <link rel="modulepreload"> in index.html,
// so the browser fetches them in one wave instead of main -> imports -> nested imports (3 waves measured, proof/load-*.json).
import { readFileSync } from 'node:fs'; import { join, dirname, normalize } from 'node:path'; import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)); let pass = 0, fail = 0;
const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };
const seen = new Set(); const walk = f => { if (seen.has(f)) return; seen.add(f);
  const src = readFileSync(join(root, f), 'utf8'); for (const m of src.matchAll(/^\s*import\s[^;]*?from\s+'(\.[^']+)'/gm)) walk(normalize(join(dirname(f), m[1])).replace(/\\/g, '/')); };
walk('src/main.js');
const html = readFileSync(join(root, 'index.html'), 'utf8'); const pre = new Set([...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(m => m[1]));
for (const f of [...seen].sort()) assert(pre.has(f), `modulepreload for ${f}`);
for (const f of pre) assert(seen.has(f), `preloaded ${f} is actually imported (no wasted preload)`);
assert(html.indexOf('rel="modulepreload"') < html.indexOf('<style>'), 'preload links come before the stylesheet in <head>');
console.log(fail ? `RESULT: ${fail} FAILED` : `RESULT: ALL ${pass} PASSED`); process.exit(fail ? 1 : 0);
