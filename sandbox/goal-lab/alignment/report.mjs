/**
 * Produce a readable alignment report (markdown + JSON).
 */
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { ALIGNMENT_REPORTS_DIR } from '../lib/paths.mjs';
import { ensureDir, writeJson } from '../lib/fs-util.mjs';
import { summary } from './monitor.mjs';
import { assertAlive } from '../kill-switch/check.mjs';
import { rememberAlignmentReport } from '../memory/store.mjs';

export function renderMarkdown(monitor, extra = {}) {
  const s = summary(monitor);
  const lines = [
    `# Alignment report`,
    ``,
    `- **Generated:** ${new Date().toISOString()}`,
    `- **Env:** ${s.envId || 'n/a'}`,
    `- **Human stated intent:** ${s.statedIntent}`,
    `- **Samples:** ${s.samples}`,
    `- **Flagged samples:** ${s.flaggedCount}`,
    `- **Max drift:** ${s.maxDrift}`,
    `- **Needs human review:** ${s.needsHumanReview ? 'YES' : 'no'}`,
    ``,
  ];
  if (extra.title) lines.splice(1, 0, ``, `> ${extra.title}`, ``);
  if (s.latest) {
    lines.push(`## Latest sample`, ``);
    lines.push(`| Field | Value |`);
    lines.push(`|---|---|`);
    lines.push(`| tick | ${s.latest.tick} |`);
    lines.push(`| drift score | ${s.latest.score} |`);
    lines.push(`| inferred effective goal | ${s.latest.inferred} |`);
    lines.push(`| stated (normalized) | ${s.latest.statedNorm} |`);
    lines.push(`| confidence | ${s.latest.confidence} |`);
    lines.push(`| flagged | ${s.latest.flagged} |`);
    lines.push(`| reason | ${s.latest.reason} |`);
    lines.push(``);
    if (s.latest.distribution) {
      lines.push(`### Action distribution (recent window)`, ``);
      for (const [k, v] of Object.entries(s.latest.distribution)) {
        lines.push(`- **${k}:** ${(v * 100).toFixed(1)}% (expected ${((s.latest.expected?.[k] || 0) * 100).toFixed(1)}%)`);
      }
      lines.push(``);
    }
  }
  if (monitor.timeline.length) {
    lines.push(`## Timeline`, ``);
    lines.push(`| tick | drift | inferred | flagged | reason |`);
    lines.push(`|---|---|---|---|---|`);
    for (const t of monitor.timeline) {
      lines.push(`| ${t.tick ?? '-'} | ${t.score} | ${t.inferred ?? '-'} | ${t.flagged ? 'FLAG' : 'ok'} | ${t.reason} |`);
    }
    lines.push(``);
  }
  lines.push(`## Notes`, ``);
  lines.push(`- This report does **not** change the active goal.`);
  lines.push(`- Goal changes require a proposal + human approval (see proposals/).`);
  lines.push(`- Kill switch remains external and is checked by the runner before steps.`);
  lines.push(``);
  return lines.join('\n');
}

export function writeReport(monitor, { id, title } = {}) {
  assertAlive('alignment.writeReport');
  const reportId = id || `align-${Date.now().toString(36)}`;
  ensureDir(ALIGNMENT_REPORTS_DIR);
  const md = renderMarkdown(monitor, { title });
  const jsonPath = join(ALIGNMENT_REPORTS_DIR, `${reportId}.json`);
  const mdPath = join(ALIGNMENT_REPORTS_DIR, `${reportId}.md`);
  const payload = {
    id: reportId,
    summary: summary(monitor),
    timeline: monitor.timeline,
    monitorMeta: {
      statedIntent: monitor.statedIntent,
      envId: monitor.envId,
      threshold: monitor.threshold,
      createdAt: monitor.createdAt,
    },
  };
  writeJson(jsonPath, payload);
  writeFileSync(mdPath, md, 'utf8');
  rememberAlignmentReport({ id: reportId, path: mdPath, summary: payload.summary });
  return { id: reportId, mdPath, jsonPath, markdown: md, summary: payload.summary };
}
