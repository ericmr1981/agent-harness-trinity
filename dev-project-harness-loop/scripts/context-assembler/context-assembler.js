#!/usr/bin/env node
/**
 * ContextAssembler — Project-aware context package builder
 *
 * Produces a structured context package for subagent injection.
 * Runs as a pre-dispatch step inside harness.js.
 *
 * Inputs: git state, features.json, sprint contracts, handoffs, source files
 * Output: harness/context/context-package-<timestamp>.md
 *
 * Usage (standalone):
 *   node context-assembler.js <repoPath> <taskDescription>
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTEXT_DIR = 'harness/context';
// ─── CLI-overridable limits ───────────────────────────────────
const MAX_FILE_SIZE_KB_DEFAULT = 8;   // skip files > N KB
const MAX_FILES_READ_DEFAULT   = 12;  // max source files to include
const MAX_DIFF_LINES_DEFAULT    = 60;  // max git diff lines
const MAX_LOG_ENTRIES_DEFAULT   = 5;   // max git log entries
const MAX_CHARS_DEFAULT         = 0;   // 0 = no cap; set via --max-chars

// Parse CLI overrides
function parseLimits(argv) {
  const limits = {
    maxFileSizeKb: MAX_FILE_SIZE_KB_DEFAULT,
    maxFiles:      MAX_FILES_READ_DEFAULT,
    maxDiffLines: MAX_DIFF_LINES_DEFAULT,
    maxLogEntries: MAX_LOG_ENTRIES_DEFAULT,
    maxChars:      MAX_CHARS_DEFAULT,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--max-file-size-kb') limits.maxFileSizeKb = parseInt(argv[++i]) || 8;
    if (argv[i] === '--max-files')         limits.maxFiles      = parseInt(argv[++i]) || 12;
    if (argv[i] === '--max-diff-lines')     limits.maxDiffLines  = parseInt(argv[++i]) || 60;
    if (argv[i] === '--max-log-entries')    limits.maxLogEntries = parseInt(argv[++i]) || 5;
    if (argv[i] === '--max-chars')           limits.maxChars      = parseInt(argv[++i]) || 0;
  }
  return limits;
}

const LIMITS = parseLimits(process.argv);

// ─────────────────────────────────────────────────────────────
// Main entry
// ─────────────────────────────────────────────────────────────
export async function run(repoPath, taskDescription, overrides = {}) {
  const workDir = repoPath || process.cwd();
  const task = taskDescription || '';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const limits = { ...LIMITS, ...overrides };

  console.log(`\n📡 ContextAssembler: building context package for:`);
  console.log(`   Repo: ${workDir}`);
  console.log(`   Task: ${task}`);
  console.log(`   Limits: maxFiles=${limits.maxFiles} maxFileSizeKb=${limits.maxFileSizeKb} maxChars=${limits.maxChars || 'none'}`);

  // Gather all context sections in parallel
  const [gitState, featuresState, contractsState, handoffsState, activeState, srcFiles] = await Promise.all([
    gatherGitState(workDir, limits),
    gatherFeatures(workDir),
    gatherContracts(workDir),
    gatherHandoffs(workDir),
    gatherActive(workDir),
    gatherRelevantSources(workDir, task, limits),
  ]);

  // Build package
  const pkg = buildPackage({ workDir, task, timestamp, gitState, featuresState, contractsState, handoffsState, activeState, srcFiles, limits });

  // Write file
  const contextDir = path.join(workDir, CONTEXT_DIR);
  await mkdir(contextDir, { recursive: true });
  const outPath = path.join(contextDir, `context-package-${timestamp}.md`);
  await writeFile(outPath, pkg);

  console.log(`   ✅ Context package: ${outPath}`);
  console.log(`   Size: ${pkg.length} chars | Source files: ${srcFiles.length} included`);

  return outPath;
}

// ─────────────────────────────────────────────────────────────
// Section 1: Git state
// ─────────────────────────────────────────────────────────────
async function gatherGitState(repoPath, limits) {
  let branch = 'unknown', status = 'unknown', log = '', diff = '';

  try {
    branch = execSync(`git -C "${repoPath}" rev-parse --abbrev-ref HEAD`, { encoding: 'utf8', timeout: 5000 }).trim();
  } catch (_) {}

  try {
    status = execSync(`git -C "${repoPath}" status --porcelain`, { encoding: 'utf8', timeout: 5000 }).trim() || '_clean_';
  } catch (_) {}

  try {
    const logRaw = execSync(`git -C "${repoPath}" log -n ${limits.maxLogEntries} --oneline`, { encoding: 'utf8', timeout: 5000 }).trim();
    log = logRaw.split('\n').map(l => `  ${l}`).join('\n');
  } catch (_) {}

  try {
    const diffRaw = execSync(`git -C "${repoPath}" diff --stat HEAD`, { encoding: 'utf8', timeout: 5000 }).trim();
    diff = diffRaw.split('\n').slice(0, limits.maxDiffLines).join('\n');
  } catch (_) {}

  let uncommitted = '';
  try {
    const staged = execSync(`git -C "${repoPath}" diff --cached --stat`, { encoding: 'utf8', timeout: 5000 }).trim();
    const unstaged = execSync(`git -C "${repoPath}" diff --stat`, { encoding: 'utf8', timeout: 5000 }).trim();
    uncommitted = `Staged:\n  ${staged || '(none)'}\nUnstaged:\n  ${unstaged || '(none)'}`;
  } catch (_) {}

  return { branch, status, log, diff, uncommitted };
}

// ─────────────────────────────────────────────────────────────
// Section 2: features.json
// ─────────────────────────────────────────────────────────────
async function gatherFeatures(repoPath) {
  const featuresPath = path.join(repoPath, 'features.json');
  try {
    const raw = await readFile(featuresPath, 'utf8');
    const data = JSON.parse(raw);
    if (data.features) {
      const unfinished = data.features.filter(f => !f.passes && !f.builtin);
      const passing = data.features.filter(f => f.passes);
      return {
        total: data.features.length,
        passing: passing.length,
        unfinished: unfinished.slice(0, 10).map(f => ({
          title: f.title,
          passes: f.passes,
          priority: f.priority || 'medium'
        }))
      };
    }
    return null;
  } catch (_) {}
  return null;
}

// ─────────────────────────────────────────────────────────────
// Section 3: Sprint contracts
// ─────────────────────────────────────────────────────────────
async function gatherContracts(repoPath) {
  const contractsDir = path.join(repoPath, 'harness', 'contracts');
  try {
    const files = (await readdir(contractsDir)).filter(f => f.endsWith('.md')).sort().slice(-3);
    const latest = files[files.length - 1];
    if (!latest) return null;
    const raw = await readFile(path.join(contractsDir, latest), 'utf8');
    return {
      latestFile: latest,
      summary: raw.slice(0, 800)
    };
  } catch (_) {}
  return null;
}

// ─────────────────────────────────────────────────────────────
// Section 4: Handoffs
// ─────────────────────────────────────────────────────────────
async function gatherHandoffs(repoPath) {
  const handoffsDir = path.join(repoPath, 'harness', 'handoffs');
  try {
    const files = (await readdir(handoffsDir)).filter(f => f.endsWith('.md')).sort().slice(-1);
    const latest = files[0];
    if (!latest) return null;
    const raw = await readFile(path.join(handoffsDir, latest), 'utf8');
    return {
      latestFile: latest,
      summary: raw.slice(0, 600)
    };
  } catch (_) {}
  return null;
}

// ─────────────────────────────────────────────────────────────
// Section 5: ACTIVE.md
// ─────────────────────────────────────────────────────────────
async function gatherActive(repoPath) {
  const activePath = path.join(repoPath, 'ACTIVE.md');
  try {
    const raw = await readFile(activePath, 'utf8');
    return { summary: raw.slice(0, 500) };
  } catch (_) {}
  return null;
}

// ─────────────────────────────────────────────────────────────
// Section 6: Relevant source files
// ─────────────────────────────────────────────────────────────
async function gatherRelevantSources(repoPath, task, limits) {
  const keywords = extractKeywords(task);
  const candidates = [];

  // Find source files
  let srcFiles = [];
  try {
    const output = execSync(
      `find "${repoPath}" -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.go" -o -name "*.java" \\) ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" 2>/dev/null`,
      { encoding: 'utf8', timeout: 10000 }
    );
    srcFiles = output.split('\n').filter(Boolean);
  } catch (_) {}

  // Score each file by keyword match
  for (const fp of srcFiles) {
    const basename = path.basename(fp).toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (basename.includes(kw)) score += 2;
    }
    if (score > 0) candidates.push({ fp, score });
  }

  // Sort by score, take top N
  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates.slice(0, limits.maxFiles);

  // Read file contents (skip large files)
  const results = [];
  for (const { fp } of selected) {
    try {
      const s = await stat(fp);
      if (s.size > limits.maxFileSizeKb * 1024) continue;
      const raw = await readFile(fp, 'utf8');
      const rel = path.relative(repoPath, fp);
      results.push({ path: rel, preview: raw.slice(0, 800) });
    } catch (_) {}
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// Keyword extraction (simple, no external deps)
// ─────────────────────────────────────────────────────────────
function extractKeywords(task) {
  // Strip common stop words, extract 3+ char alphanumeric tokens
  const stopWords = new Set(['the', 'and', 'for', 'with', 'to', 'from', 'this', 'that', 'file', 'files', 'add', 'implement', 'fix', 'update', 'change', 'the', 'please', '帮我', '一下', '需要', '实现', '修复', '新增', '一个', '什么', '如何', '怎么', '有没有']);
  const tokens = task.toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !stopWords.has(t));
  return [...new Set(tokens)];
}

// ─────────────────────────────────────────────────────────────
// Build the context package markdown
// ─────────────────────────────────────────────────────────────
function buildPackage({ workDir, task, timestamp, gitState, featuresState, contractsState, handoffsState, activeState, srcFiles, limits }) {
  const lines = [];

  lines.push(`# Context Package`);
  lines.push(`> Built by ContextAssembler | ${timestamp} | task: ${task}`);
  lines.push('');

  // ── Git State ──────────────────────────────────────────────
  lines.push(`## 📋 Git State`);
  lines.push(`- **Branch**: \`${gitState.branch}\``);
  lines.push(`- **Status**: ${gitState.status === '_clean_' ? '✅ clean' : '⚠️ dirty'}`);
  if (gitState.status !== '_clean_') {
    lines.push(`\`\`\``);
    lines.push(gitState.status);
    lines.push(`\`\`\``);
  }
  lines.push('');
  if (gitState.log) {
    lines.push(`## 📜 Recent Commits (last ${MAX_LOG_ENTRIES})`);
    lines.push('```');
    lines.push(gitState.log);
    lines.push('```');
    lines.push('');
  }
  if (gitState.diff) {
    lines.push(`## 🔍 Uncommitted Changes`);
    lines.push('```');
    lines.push(gitState.diff);
    lines.push('```');
    lines.push('');
  }

  // ── Features ──────────────────────────────────────────────
  if (featuresState) {
    lines.push(`## 🎯 Features (${featuresState.passing}/${featuresState.total} passing)`);
    if (featuresState.unfinished.length > 0) {
      lines.push('### Unfinished:');
      for (const f of featuresState.unfinished) {
        lines.push(`- [ ] **${f.title}** (${f.priority})`);
      }
    } else {
      lines.push('✅ All features passing');
    }
    lines.push('');
  }

  // ── Active Contract ────────────────────────────────────────
  if (contractsState) {
    lines.push(`## 📄 Latest Sprint Contract`);
    lines.push(`**File**: \`${contractsState.latestFile}\``);
    lines.push('');
    lines.push(contractsState.summary);
    lines.push('');
  }

  // ── Latest Handoff ─────────────────────────────────────────
  if (handoffsState) {
    lines.push(`## 🔄 Latest Handoff`);
    lines.push(`**File**: \`${handoffsState.latestFile}\``);
    lines.push('');
    lines.push(handoffsState.summary);
    lines.push('');
  }

  // ── ACTIVE.md ─────────────────────────────────────────────
  if (activeState) {
    lines.push(`## ▶️  ACTIVE.md`);
    lines.push(activeState.summary);
    lines.push('');
  }

  // ── Relevant Source Files ──────────────────────────────────
  if (srcFiles.length > 0) {
    lines.push(`## 📂 Relevant Source Files (task keywords matched)`);
    lines.push('');
    for (const { path: fp, preview } of srcFiles) {
      lines.push(`### \`${fp}\``);
      lines.push('```');
      lines.push(preview);
      lines.push('```');
      lines.push('');
    }
  }

  lines.push(`---`);
  lines.push(`*ContextAssembler v1 | ${timestamp}*`);

  let pkg = lines.join('\n');
  if (limits.maxChars > 0 && pkg.length > limits.maxChars) {
    pkg = pkg.slice(0, limits.maxChars);
    pkg += `\n\n*[TRUNCATED by ContextAssembler: exceeded ${limits.maxChars} char limit]*`;
  }
  return pkg;
}

// ─────────────────────────────────────────────────────────────
// CLI standalone entry
// ─────────────────────────────────────────────────────────────
if (process.argv[1] === __filename) {
  const repoPath = process.argv[2] || process.cwd();
  const taskDescription = process.argv.slice(3).join(' ');
  const overrides = {};
  for (let i = 3; i < process.argv.length; i++) {
    if (process.argv[i] === '--max-files')        overrides.maxFiles      = parseInt(process.argv[++i]);
    if (process.argv[i] === '--max-file-size-kb') overrides.maxFileSizeKb = parseInt(process.argv[++i]);
    if (process.argv[i] === '--max-chars')         overrides.maxChars      = parseInt(process.argv[++i]);
  }
  run(repoPath, taskDescription, overrides).catch(err => {
    console.error('❌ ContextAssembler error:', err.message);
    process.exit(1);
  });
}
