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
import { execSync, execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTEXT_DIR = 'harness/context';
// ─── CLI-overridable limits ───────────────────────────────────
const MAX_FILE_SIZE_KB_DEFAULT = 16;   // inline preview only if <= N KB (large files use snippet extraction)
const MAX_FILES_READ_DEFAULT   = 12;  // max source files to include (previews + snippet sources)
const MAX_DIFF_LINES_DEFAULT    = 60;  // max git diff lines
const MAX_LOG_ENTRIES_DEFAULT   = 5;   // max git log entries
const MAX_CHARS_DEFAULT         = 0;   // 0 = no cap; set via --max-chars
const PROFILE_DEFAULT           = 'standard'; // minimal | standard | full
const TARGET_DEFAULT            = 'subagent'; // subagent | verifier

// Parse CLI overrides
function parseLimits(argv) {
  const limits = {
    maxFileSizeKb: MAX_FILE_SIZE_KB_DEFAULT,
    maxFiles:      MAX_FILES_READ_DEFAULT,
    maxDiffLines: MAX_DIFF_LINES_DEFAULT,
    maxLogEntries: MAX_LOG_ENTRIES_DEFAULT,
    maxChars:      MAX_CHARS_DEFAULT,
    profile:       PROFILE_DEFAULT,
    target:        TARGET_DEFAULT,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--max-file-size-kb') limits.maxFileSizeKb = parseInt(argv[++i]) || 8;
    if (argv[i] === '--max-files')        limits.maxFiles = parseInt(argv[++i]) || 12;
    if (argv[i] === '--max-diff-lines')   limits.maxDiffLines = parseInt(argv[++i]) || 60;
    if (argv[i] === '--max-log-entries')  limits.maxLogEntries = parseInt(argv[++i]) || 5;
    if (argv[i] === '--max-chars')        limits.maxChars = parseInt(argv[++i]) || 0;
    if (argv[i] === '--profile')          limits.profile = argv[++i] || PROFILE_DEFAULT;
    if (argv[i] === '--target')           limits.target = argv[++i] || TARGET_DEFAULT;
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
  console.log(`   Profile: ${limits.profile} | Target: ${limits.target}`);
  console.log(`   Limits: maxFiles=${limits.maxFiles} maxFileSizeKb=${limits.maxFileSizeKb} maxChars=${limits.maxChars || 'none'}`);

  const sectionPlan = deriveSectionPlan(limits.profile, limits.target);

  // Gather all context sections in parallel (but gate heavy sections by profile)
  const [gitState, featuresState, contractsState, handoffsState, activeState, relevant] = await Promise.all([
    sectionPlan.includeGit ? gatherGitState(workDir, limits) : Promise.resolve(null),
    sectionPlan.includeFeatures ? gatherFeatures(workDir) : Promise.resolve(null),
    sectionPlan.includeContracts ? gatherContracts(workDir) : Promise.resolve(null),
    sectionPlan.includeHandoffs ? gatherHandoffs(workDir) : Promise.resolve(null),
    sectionPlan.includeActive ? gatherActive(workDir) : Promise.resolve(null),
    sectionPlan.includeRelevant ? gatherRelevantMaterials(workDir, task, limits) : Promise.resolve({ previews: [], snippets: [] }),
  ]);

  // Build package + metadata
  const pkg = buildPackage({ workDir, task, timestamp, gitState, featuresState, contractsState, handoffsState, activeState, relevant, limits, sectionPlan });
  const meta = buildContextMeta({ workDir, task, timestamp, limits, sectionPlan, relevant, featuresState, contractsState, handoffsState, activeState });

  // Write files
  const contextDir = path.join(workDir, CONTEXT_DIR);
  await mkdir(contextDir, { recursive: true });
  const outPath = path.join(contextDir, `context-package-${timestamp}.md`);
  const metaPath = path.join(contextDir, `context-package-${timestamp}.json`);
  await writeFile(outPath, pkg);
  await writeFile(metaPath, JSON.stringify(meta, null, 2));

  console.log(`   ✅ Context package: ${outPath}`);
  console.log(`   🧾 Context meta: ${metaPath}`);
  console.log(`   Size: ${pkg.length} chars | Previews: ${relevant.previews.length} | Snippet files: ${relevant.snippets.length}`);

  return outPath;
}

/** Derive which sections to include based on profile + target */
function deriveSectionPlan(profile, target) {
  const minimal = ['git', 'relevant'];
  const standard = ['git', 'active', 'features', 'relevant'];
  const full = ['git', 'active', 'features', 'contracts', 'handoffs', 'relevant'];

  let include = full;
  if (profile === 'minimal') include = minimal;
  else if (profile === 'standard') include = standard;

  const conditional = (profile === 'standard' || profile === 'full')
    ? ['features', 'contracts']
    : [];
  const onDemand = profile === 'full' ? ['handoffs'] : [];

  return {
    includeSections: include,
    conditionalSections: conditional,
    onDemandSections: onDemand,
    sectionPlanDescription: `[${include.join(', ')}]` +
      (conditional.length ? ` +conditional[${conditional.join(',')}]` : '') +
      (onDemand.length ? ` +onDemand[${onDemand.join(',')}]` : ''),
  };
}

/** Write a machine-readable .json companion alongside the .md package */
function buildContextMeta({ workDir, task, timestamp, limits, sectionPlan, relevant, featuresState, contractsState, handoffsState, activeState }) {
  return {
    generatedAt: new Date().toISOString(),
    workDir,
    task,
    profile: limits.profile,
    target: limits.target,
    sectionPlan: sectionPlan.sectionPlanDescription,
    includeSections: sectionPlan.includeSections,
    conditionalSections: sectionPlan.conditionalSections,
    onDemandSections: sectionPlan.onDemandSections,
    stats: {
      previewCount: relevant.previews.length,
      snippetCount: relevant.snippets.length,
      featuresCount: featuresState?.features?.length || 0,
      contractsCount: contractsState?.contracts?.length || 0,
      handoffsCount: handoffsState?.handoffs?.length || 0,
      hasActive: activeState?.hasActive || false,
    },
    callSignature: `ContextAssembler invoked with --profile=${limits.profile} --target=${limits.target}`,
  };
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
    const entries = Array.isArray(data)
      ? data
      : Array.isArray(data?.features)
        ? data.features
        : null;
    if (!entries) return null;

    const normalized = entries.map((f, index) => ({
      id: f.id || `F-${String(index + 1).padStart(3, '0')}`,
      title: f.title || `Feature ${index + 1}`,
      passes: Boolean(f.passes),
      status: f.passes ? 'done' : (f.status || 'todo'),
      priority: Number.isFinite(f.priority) ? f.priority : index + 1,
      size: f.size || '',
      acceptanceCriteriaCount: Array.isArray(f.acceptanceCriteria) ? f.acceptanceCriteria.length : 0,
      builtin: Boolean(f.builtin)
    }));

    const unfinished = normalized.filter(f => !f.passes && !f.builtin && f.status !== 'done');
    const passing = normalized.filter(f => f.passes);
    return {
      total: normalized.length,
      passing: passing.length,
      unfinished: unfinished.slice(0, 10).map(f => ({
        id: f.id,
        title: f.title,
        passes: f.passes,
        status: f.status,
        priority: f.priority,
        size: f.size || 'n/a',
        acceptanceCriteriaCount: f.acceptanceCriteriaCount
      }))
    };
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
// Section 6: Relevant materials (previews + snippet extraction)
// ─────────────────────────────────────────────────────────────
async function gatherRelevantMaterials(repoPath, task, limits) {
  const keywords = extractKeywords(task);

  // A) Small file previews (code-first, fast)
  const previewCandidates = await findFiles(repoPath, [
    '*.ts','*.tsx','*.js','*.jsx','*.py','*.go','*.java'
  ], {
    exclude: [
      '*/node_modules/*','*/.git/*','*/dist/*','*/build/*',
      '*/.venv/*','*/site-packages/*',           // Python venv / pip packages
      '*/harness/artifacts/*','*/harness/context/*',  // harness generated (self-avoid)
      '*/harness/reports/*','*/harness/qa/*',
      '*/.next/*','*/coverage/*','*/dist_prod/*'  // other build/cache artifacts
    ],
    timeoutMs: 12000
  });

  const scored = previewCandidates
    .map(fp => ({ fp, score: scoreByBasename(fp, keywords) }))
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score)
    .slice(0, limits.maxFiles);

  const previews = [];
  for (const { fp } of scored) {
    try {
      const s = await stat(fp);
      if (s.size > limits.maxFileSizeKb * 1024) continue; // large code file: don't inline
      const raw = await readFile(fp, 'utf8');
      previews.push({ path: path.relative(repoPath, fp), preview: raw.slice(0, 800) });
    } catch (_) {}
  }

  // B) Snippet extraction (docs + large files)
  // Goal: never inject huge docs verbatim; extract only relevant windows.
  const snippets = await extractRelevantSnippets(repoPath, keywords, {
    maxFiles: Math.min(6, limits.maxFiles),
    maxSnippetsPerFile: 3,
    contextLines: 20,
    maxTotalChars: 8000,
    timeoutMs: 12000
  });

  return { previews, snippets };
}

async function findFiles(repoPath, globs, { exclude = [], timeoutMs = 10000 } = {}) {
  const findParts = globs.map(g => `-name "${g}"`).join(' -o ');
  const excludeParts = exclude.map(p => `! -path "${p}"`).join(' ');
  const cmd = `find "${repoPath}" -type f \\( ${findParts} \\) ${excludeParts} 2>/dev/null`;
  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: timeoutMs });
    return output.split('\n').filter(Boolean);
  } catch (_) {
    return [];
  }
}

function scoreByBasename(fp, keywords) {
  const basename = path.basename(fp).toLowerCase();
  let score = 0;
  for (const kw of keywords) if (basename.includes(kw)) score += 2;
  return score;
}

async function extractRelevantSnippets(repoPath, keywords, opts) {
  if (!keywords || keywords.length === 0) return [];

  // Build a safe-ish OR pattern for ripgrep.
  const escaped = keywords
    .filter(k => k.length >= 3)
    .slice(0, 12)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return [];
  const pattern = escaped.join('|');

  // Search docs (no full inline): exclude obvious noise + self-contamination.
  const rgArgs = [
    '--no-heading',
    '--line-number',
    '--ignore-case',
    '--max-count', '200',
    '--glob', '!*node_modules/**',
    '--glob', '!*dist/**',
    '--glob', '!*build/**',
    '--glob', '!*\\.git/**',
    '--glob', '!*harness/artifacts/**',
    '--glob', '!*harness/context/**',
    '--glob', '!*harness/reports/**',
    '--glob', '!*harness/qa/**',
    '--glob', '!*\\.venv/**',
    '--glob', '!*site-packages/**',
    '--glob', '!*\\.next/**',
    '--glob', '!*coverage/**',
    '--glob', '*.md',
    '--glob', '*.txt',
    '--glob', '*.mdx',
    pattern,
    repoPath
  ];

  let hits = [];
  try {
    const out = execFileSync('rg', rgArgs, { encoding: 'utf8', timeout: opts.timeoutMs || 12000 });
    // format: path:line:match
    hits = out.split('\n').filter(Boolean).map(line => {
      const m = line.match(/^(.*?):(\d+):(.*)$/);
      if (!m) return null;
      return { file: m[1], line: parseInt(m[2], 10), text: m[3] };
    }).filter(Boolean);
  } catch (_) {
    return [];
  }

  // Group by file, score by hit count.
  const byFile = new Map();
  for (const h of hits) {
    const key = h.file;
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key).push(h);
  }

  const rankedFiles = [...byFile.entries()]
    .map(([file, arr]) => ({ file, hits: arr, score: arr.length }))
    .sort((a,b) => b.score - a.score)
    .slice(0, opts.maxFiles || 6);

  const results = [];
  let totalChars = 0;

  for (const rf of rankedFiles) {
    if (totalChars >= (opts.maxTotalChars || 8000)) break;

    let raw = '';
    try {
      raw = await readFile(rf.file, 'utf8');
    } catch (_) {
      continue;
    }
    const lines = raw.split(/\r?\n/);

    const hitLines = [...new Set(rf.hits.map(h => h.line))].sort((a,b) => a-b).slice(0, opts.maxSnippetsPerFile || 3);
    const windows = [];

    for (const ln of hitLines) {
      const start = Math.max(1, ln - (opts.contextLines || 20));
      const end = Math.min(lines.length, ln + (opts.contextLines || 20));
      windows.push({ start, end });
    }

    // Merge overlapping windows
    windows.sort((a,b) => a.start - b.start);
    const merged = [];
    for (const w of windows) {
      const last = merged[merged.length - 1];
      if (!last || w.start > last.end + 1) merged.push({ ...w });
      else last.end = Math.max(last.end, w.end);
    }

    const rel = path.relative(repoPath, rf.file);
    for (const w of merged) {
      if (totalChars >= (opts.maxTotalChars || 8000)) break;

      const chunk = lines.slice(w.start - 1, w.end).join('\n');
      // Estimate contribution to the final markdown size without risking template-literal backtick issues.
      const header = '### `' + rel + '` (lines ' + w.start + '-' + w.end + ')';
      const estimated = header.length + chunk.length + 16; // fences + spacing
      totalChars += estimated;
      results.push({ path: rel, startLine: w.start, endLine: w.end, snippet: chunk });
    }
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
function buildPackage({ workDir, task, timestamp, gitState, featuresState, contractsState, handoffsState, activeState, relevant, limits, sectionPlan }) {
  const lines = [];
  const sp = sectionPlan || { includeSections: ['git','active','features','contracts','relevant'], conditionalSections: [], onDemandSections: [] };
  const req = (s, content) => sp.includeSections.includes(s) ? content : null;
  const cond = (s, content) => sp.conditionalSections.includes(s) ? content : null;
  const onDemand = (s, content) => sp.onDemandSections.includes(s) ? content : null;

  lines.push(`# Context Package`);
  lines.push(`> Built by ContextAssembler | ${timestamp} | task: ${task}`);
  lines.push(`> Profile: ${limits.profile} | Target: ${limits.target} | Sections: ${sp.sectionPlanDescription}`);
  lines.push('');

  // ── Git State [required] ───────────────────────────────────
  const gitSection = req('git', () => {
    const out = [];
    out.push(`## 📋 Git State  \[required\]`);
    out.push(`- **Branch**: \`${gitState.branch}\``);
    out.push(`- **Status**: ${gitState.status === '_clean_' ? '✅ clean' : '⚠️ dirty'}`);
    if (gitState.status !== '_clean_') {
      out.push(`\`\`\``);
      out.push(gitState.status);
      out.push(`\`\`\``);
    }
    out.push('');
    if (gitState.log) {
      out.push(`### 📜 Recent Commits (last ${limits.maxLogEntries})  \[required\]`);
      out.push('```');
      out.push(gitState.log);
      out.push('```');
      out.push('');
    }
    if (gitState.diff) {
      out.push(`### 🔍 Uncommitted Changes  \[conditional\]`);
      out.push('```');
      out.push(gitState.diff);
      out.push('```');
      out.push('');
    }
    return out.join('\n');
  });
  if (gitSection) lines.push(gitSection);

  // ── Active State [required in standard] ───────────────────
  const activeSection = req('active', () => {
    if (!activeState.hasActive) return null;
    const out = [];
    out.push(`## ⚡ Active Run  \[required\]`);
    out.push(`- **Type**: ${activeState.activeType}`);
    out.push(`- **Started**: ${activeState.startedAt}`);
    out.push(`- **Branch**: \`${activeState.branch}\``);
    if (activeState.brief) {
      out.push('');
      out.push(activeState.brief);
    }
    out.push('');
    return out.join('\n');
  });
  if (activeSection) lines.push(activeSection);

  // ── Features [conditional] ─────────────────────────────────
  const featSection = cond('features', () => {
    if (!featuresState) return null;
    const out = [];
    out.push(`## 🎯 Features (${featuresState.passing}/${featuresState.total} passing)  \[conditional\]`);
    if (featuresState.unfinished.length > 0) {
      out.push('### Unfinished:');
      for (const f of featuresState.unfinished) {
        const extras = [`priority=${f.priority}`, `size=${f.size || 'n/a'}`, `acceptance=${f.acceptanceCriteriaCount || 0}`].join(' | ');
        out.push(`- [ ] **${f.id}: ${f.title}** (${extras})`);
      }
    } else {
      out.push('✅ All features passing');
    }
    out.push('');
    return out.join('\n');
  });
  if (featSection) lines.push(featSection);

  // ── Contracts [conditional] ───────────────────────────────
  const contractSection = cond('contracts', () => {
    if (!contractsState) return null;
    const out = [];
    out.push(`## 📄 Latest Sprint Contract  \[conditional\]`);
    out.push(`**File**: \`${contractsState.latestFile}\``);
    out.push('');
    out.push(contractsState.summary);
    out.push('');
    return out.join('\n');
  });
  if (contractSection) lines.push(contractSection);

  // ── Latest Handoff [on-demand] ─────────────────────────────
  const handoffSection = onDemand('handoffs', () => {
    if (!handoffsState) return null;
    const out = [];
    out.push(`## 🔄 Latest Handoff  \[on-demand\]`);
    out.push(`**File**: \`${handoffsState.latestFile}\``);
    out.push('');
    out.push(handoffsState.summary);
    out.push('');
    return out.join('\n');
  });
  if (handoffSection) lines.push(handoffSection);

  // ── Relevant Snippets (docs/large files, extracted windows) ─ [required]
  if (relevant?.snippets?.length > 0) {
    lines.push(`## ✂️  Relevant Snippets (extracted; large docs are NOT inlined)`);
    lines.push(`> If more context is needed, request specific files/sections; do not ask for “the whole doc”.`);
    lines.push('');

    // Group snippets by file
    const byFile = new Map();
    for (const s of relevant.snippets) {
      if (!byFile.has(s.path)) byFile.set(s.path, []);
      byFile.get(s.path).push(s);
    }

    for (const [fp, arr] of byFile.entries()) {
      lines.push(`### \`${fp}\``);
      for (const snip of arr) {
        lines.push(`#### lines ${snip.startLine}-${snip.endLine}`);
        lines.push('```');
        lines.push(snip.snippet);
        lines.push('```');
        lines.push('');
      }
    }
  }

  // ── Small File Previews (inline only if small) ────────────── [required]
  if (relevant?.previews?.length > 0) {
    lines.push(`## 📂 Relevant Small File Previews (keyword matched; size-capped)`);
    lines.push('');
    for (const { path: fp, preview } of relevant.previews) {
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
