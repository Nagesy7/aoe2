import {
  mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync,
  readdirSync, statSync, appendFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';

export function ensureDir(p) {
  mkdirSync(p, { recursive: true });
  return p;
}

export function writeJson(path, obj) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

export function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function appendJsonlSync(path, obj) {
  ensureDir(dirname(path));
  appendFileSync(path, JSON.stringify({ ...obj, _ts: new Date().toISOString() }) + '\n', 'utf8');
}

export function wipeDir(p) {
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

export function copyDir(src, dest) {
  ensureDir(dirname(dest));
  cpSync(src, dest, { recursive: true });
}

export function listDirs(p) {
  if (!existsSync(p)) return [];
  return readdirSync(p).filter(n => {
    try { return statSync(join(p, n)).isDirectory(); } catch { return false; }
  });
}

export function listFiles(p, suffix = '') {
  if (!existsSync(p)) return [];
  return readdirSync(p).filter(n => !suffix || n.endsWith(suffix));
}

export { existsSync, readFileSync, writeFileSync, rmSync, join, dirname };
