#!/usr/bin/env node
/**
 * Project Kickoff scaffolder (Trinity module)
 *
 * Writes a standard early-phase doc set into a target repo.
 *
 * Usage:
 *   node project-kickoff/scripts/kickoff.js --repo "/abs/path" --name "myproj" --desc "..." [--stack node|python|go|mixed] [--mode lean|full]
 */

import fs from 'fs/promises';
import path from 'path';

function arg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function has(name) {
  return process.argv.includes(name);
}

const repo = arg('--repo') || process.cwd();
const name = arg('--name') || path.basename(repo);
const desc = arg('--desc') || '';
const stack = (arg('--stack') || 'mixed').toLowerCase();
const mode = (arg('--mode') || 'lean').toLowerCase();

if (!repo) {
  console.error('❌ Missing --repo');
  process.exit(2);
}

const now = new Date();
const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

async function exists(p) {
  try { await fs.stat(p); return true; } catch { return false; }
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function writeIfMissing(filePath, content) {
  if (await exists(filePath)) return { path: filePath, action: 'skip' };
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');
  return { path: filePath, action: 'write' };
}

function prdTemplate() {
  return `# PRD — ${name}\n\n> Kickoff: ${ts}\n> Stack: ${stack}\n\n## 1. 背景 / 目标\n- Why now?\n- 业务目标（可量化）：\n\n## 2. 用户与场景\n- 目标用户：\n- 核心场景（Top 3）：\n\n## 3. 需求范围\n### In scope\n- \n\n### Out of scope\n- \n\n## 4. 验收标准（Acceptance Criteria）\n- AC-1: \n- AC-2: \n\n## 5. 约束与非功能需求\n- 性能：\n- 成本：\n- 安全/合规：\n- 部署环境：\n\n## 6. 风险与未知\n- Risk-1:\n\n## 7. 里程碑\n- M1: Kickoff docs confirmed\n- M2: Prototype/Spike evidence\n- M3: Implementation\n\n`;
}

function architectureDraftTemplate() {
  return `# Architecture Draft — ${name}\n\n> Kickoff: ${ts}\n\n## 1. 设计目标\n- \n\n## 2. 系统边界\n- Upstream / Downstream：\n\n## 3. 模块划分（粗粒度）\n- Module A: \n- Module B: \n\n## 4. 数据流 / 时序（文字版）\n- \n\n## 5. 部署形态\n- 单机 / 容器 / 云服务：\n\n## 6. 关键接口（草案）\n- API-1: \n\n## 7. 观测性与运维\n- logging / metrics / alert：\n\n## 8. 未决问题（Open Questions）\n- Q1: \n\n`;
}

function adrTechStackTemplate() {
  return `# ADR-0001: Tech Stack Decision — ${name}\n\n- Status: proposed\n- Date: ${ts}\n\n## Context\n${desc || '- (fill in)'}\n\n## Decision Drivers\n- Time-to-market\n- Team familiarity\n- Deployability\n- Cost\n- Observability\n\n## Options Considered\n1) Option A\n2) Option B\n\n## Decision\n- Chosen: (TBD)\n\n## Consequences\n### Positive\n- \n\n### Negative\n- \n\n## Validation Plan (Spike)\n- What evidence will prove this choice is correct?\n- Benchmark / Prototype checklist:\n  - [ ] \n\n`;
}

function goalContractTemplate() {
  return `# Goal Contract — ${name}\n\n> Kickoff: ${ts}\n\n## Goal\n- \n\n## Non-Goals\n- \n\n## Acceptance (Definition of Done)\n- [ ] Build passes\n- [ ] Tests pass\n- [ ] Key user flows validated\n\n## Oracle (verification commands)
\n\`\`\`
# fill in project-specific commands
\`\`\`
\n`;
}

function featuresJsonTemplate() {
  return JSON.stringify({
    features: [
      { title: 'Kickoff scaffolding present', passes: false, builtin: false, priority: 'high' }
    ]
  }, null, 2) + '\n';
}

async function main() {
  const outputs = [];

  outputs.push(await writeIfMissing(path.join(repo, 'docs/kickoff/PRD.md'), prdTemplate()));
  outputs.push(await writeIfMissing(path.join(repo, 'docs/kickoff/ARCHITECTURE_DRAFT.md'), architectureDraftTemplate()));
  outputs.push(await writeIfMissing(path.join(repo, 'docs/decisions/ADR-0001-tech-stack.md'), adrTechStackTemplate()));

  // Keep compatibility with Trinity harness layout
  outputs.push(await writeIfMissing(path.join(repo, 'harness/goal.md'), goalContractTemplate()));
  outputs.push(await writeIfMissing(path.join(repo, 'features.json'), featuresJsonTemplate()));

  // Minimal index note
  if (mode !== 'lean') {
    outputs.push(await writeIfMissing(path.join(repo, 'docs/kickoff/README.md'), `# Kickoff Pack\n\n- PRD: docs/kickoff/PRD.md\n- Architecture draft: docs/kickoff/ARCHITECTURE_DRAFT.md\n- ADR: docs/decisions/ADR-0001-tech-stack.md\n`));
  }

  const wrote = outputs.filter(o => o.action === 'write').length;
  const skipped = outputs.filter(o => o.action === 'skip').length;

  console.log(`✅ Kickoff completed for: ${repo}`);
  console.log(`- wrote: ${wrote}, skipped(existing): ${skipped}`);
  for (const o of outputs) console.log(`  - ${o.action.toUpperCase()}: ${path.relative(repo, o.path)}`);
}

main().catch(err => {
  console.error('❌ Kickoff failed:', err?.message || err);
  process.exit(1);
});
