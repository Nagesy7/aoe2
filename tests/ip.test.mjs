// IP guard: fails if any shipped, player- or repo-visible text uses third-party RTS franchise names, its age/tech/unit
// names, taunt lines, or publisher names. Scans shipped files (with code identifiers stripped) plus every display-name
// table in the game data. Run: node tests/ip.test.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'; import { join } from 'node:path'; import { fileURLToPath } from 'node:url';
import { BUILDINGS, UNITS, TECHS, AGE_NAMES } from '../src/techtree.js';
import { CIVS, COSMETICS as CIV_COS } from '../src/civs.js';
import { COSMETICS } from '../src/kibble.js';
const root = fileURLToPath(new URL('..', import.meta.url));
export const BANNED = [/age\s*of\s*empires/i, /\baoe\s*[1-4i]*\b/i, /\baoe2\b/i, /microsoft/i, /ensemble studios/i, /forgotten empires/i, /\bwololo\b/i, /\bwololo/i,
  /\bdark age\b/i, /\bfeudal age\b/i, /\bcastle age\b/i, /\bimperial age\b/i, /\btown cent(er|re)s?\b/i, /\bman[- ]at[- ]arms\b/i, /\blong swordsman\b/i, /\bchampion\b/i,
  /\bmilitia\b/i, /\bhalberdier\b/i, /\bpikeman\b/i, /\bcrossbowman\b/i, /\barbalester\b/i, /\bscout cavalry\b/i, /\blight cavalry\b/i, /\bpaladin\b/i, /\bcavalier\b/i, /\btrebuchet\b/i,
  /\bwheelbarrow\b/i, /\bhand cart\b/i, /\bloom\b/i, /\bbodkin arrow\b/i, /\bfletching\b/i, /\bbracer\b/i, /\bpadded archer armor\b/i, /\bchain mail\b/i, /\bscale mail\b/i,
  /\bdouble[- ]bit axe\b/i, /\bbow saw\b/i, /\btwo[- ]man saw\b/i, /\bhorse collar\b/i, /\bheavy plow\b/i, /\bcrop rotation\b/i, /\bgold mining\b/i, /\bgold shaft mining\b/i,
  /\bstone mining\b/i, /\bstone shaft mining\b/i, /\bforging\b/i, /\biron casting\b/i, /\bblast furnace\b/i, /\bballistics\b/i, /\bmasonry\b/i, /\bmurder holes\b/i,
  /\blumber camp\b/i, /\bmining camp\b/i, /\barchery range\b/i, /\bbritons\b/i, /\bfranks\b/i, /\bteutons\b/i, /\bbyzantines\b/i, /\bsaracens\b/i, /\bmongols\b/i, /\bcelts\b/i,
  /\bstart the game already\b/i, /\b(yes|no)\?? *\(taunt\)/i, /\bsure, blame it on your isp\b/i, /\bopenage\b/i];
const lines = []; let fail = 0, pass = 0; const log = s => { console.log(s); lines.push(s); };
const assert = (c, m) => { log(`${c ? 'PASS' : 'FAIL'}: ${m}`); c ? pass++ : fail++; };
const hits = (txt) => BANNED.filter(r => r.test(txt)).map(r => (txt.match(r) || [''])[0]);
// 1. display data
const display = [...Object.values(BUILDINGS).map(b => b.name), ...Object.values(UNITS).map(u => u.name), ...Object.values(TECHS).flatMap(t => [t.name, t.desc]), ...Object.values(AGE_NAMES),
  ...Object.values(CIVS).flatMap(c => [c.name, c.style, ...c.traits]), ...Object.values(CIV_COS).flat().map(c => c.name), ...Object.values(COSMETICS).map(c => c.name)].filter(Boolean);
const bad = display.flatMap(s => hits(s).map(h => `${s} [${h}]`));
assert(bad.length === 0, `display names (${display.length}) free of banned terms${bad.length ? ': ' + bad.join('; ') : ''}`);
// 2. shipped / repo-visible files, with code identifiers (snake_case ids, quoted ids, `code` spans, property keys) stripped
const files = []; const walk = d => { for (const f of readdirSync(join(root, d))) { const p = join(d, f); const st = statSync(join(root, p)); if (st.isDirectory()) walk(p); else if (/\.(js|mjs|html|md|json|css)$/.test(f)) files.push(p); } };
for (const d of ['src', 'api', 'server', 'docs']) walk(d); files.push('index.html', 'README.md', 'package.json', 'art/manifest.json', 'sim/balance.mjs');
const strip = t => t.replace(/[\w./-]+\.(png|js|mjs|json)\b/g, ' ').replace(/`[^`\n]*`/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\b[a-z]+(_[a-z0-9]+)+\b/g, ' ').replace(/(['"])[a-z][a-z0-9_]*\1/g, ' ').replace(/\b[a-z_][a-z0-9_]*\s*:/g, ' ').replace(/\.[a-z_]+\b/g, ' ').replace(/\b(case|t ===|type ===)\s*'[^']*'/g, ' ');
for (const f of files) { if (f === 'docs/IP_AUDIT.md') continue; // the audit itself lists the old names on purpose
  const t = strip(readFileSync(join(root, f), 'utf8')); const h = [...new Set(hits(t))]; assert(h.length === 0, `${f}: no banned terms${h.length ? ' -> ' + h.join(', ') : ''}`); }
log(fail ? `RESULT: ${fail} FAILED, ${pass} PASSED` : `RESULT: ALL ${pass} PASSED`);
process.exit(fail ? 1 : 0);
