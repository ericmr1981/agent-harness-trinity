#!/usr/bin/env node
/**
 * /harness v4 — Token-aware, Complexity-scored, Multi-mode dispatch
 *
 * Changes from v3:
 * - Token-aware modes: --mode minimal | keyword | llm | llm-full
 * - Complexity scoring card (pre-computed by main agent)
 * - Selective attachments based on task complexity
 * - Agency agent decision tree (replaces keyword-only)
 * - Token tracking in .harness-master.json
 * - Post-task report generation (harness/reports/)
 *
 * Usage:
 *   /harness [flags] <task description>
 *   /harness --mode minimal "改错别字"
 *   /harness --mode keyword --complexity 3 "单文件改动"\n *   /harness --no-preflight "快速实验（跳过 harness 检测）"
 *   /harness --complexity 7 "复杂多角色任务"
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { run as runContextAssembler } from './context-assembler/context-assembler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_DIR = __dirname;

const WORKSPACE      = process.env.OPENCLAW_WORKSPACE || process.cwd();
const HARNESS_DIR    = path.join(WORKSPACE, 'harness');
const REPORTS_DIR    = path.join(HARNESS_DIR, 'reports');
const HARNESS_ARTIFACTS_DIR = path.join(HARNESS_DIR, 'artifacts');
const CONTINUE_GATE_ARTIFACTS_DIR = path.join(HARNESS_ARTIFACTS_DIR, 'continue-gate');
const ORACLES_DIR     = path.join(HARNESS_DIR, 'oracles');            // P1-5: per-repo oracle registry (relative to WORKSPACE)
const ORACLES_FILE    = path.join(ORACLES_DIR, 'registry.json');     // P1-5: oracle registry file (relative to WORKSPACE)
const WORKSPACE_ROOT = WORKSPACE;                                          // workspace root (parent of all project repos)
const TASKS_FILE     = path.join(WORKSPACE, 'TASKS.md');                 // single project registry index
const GITHUB_ROOT    = process.env.GITHUB_ROOT || '/Users/ericmr/Documents/GitHub';
const MASTER_CONFIG_FILE = path.join(WORKSPACE, '.harness-master.json');

// ─────────────────────────────────────────────────────────────
// ARGUMENT PARSING
// ─────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
const MODE_ARG    = extractArg('--mode', rawArgs) || 'llm';           // default: full LLM
const COMPLEXITY  = parseInt(extractArg('--complexity', rawArgs) || '0'); // 0 = auto
const DRY_RUN     = rawArgs.includes('--dry-run');
const CONSUME_RESULT = rawArgs.includes('--consume-result');
const GOAL_CLOSED = rawArgs.includes('--goal-closed');
const BLOCKED_EXTERNAL = rawArgs.includes('--blocked-external');
const BLOCKED_APPROVAL = rawArgs.includes('--blocked-approval');
const RESULT_STATUS = extractArg('--result-status', rawArgs) || '';
const FAILURE_TYPE = extractArg('--failure-type', rawArgs) || '';
const EVIDENCE_ARTIFACT = extractArg('--evidence-artifact', rawArgs) || '';
const FINAL_ORACLE_INPUT = extractArg('--final-oracle', rawArgs) || '';
const LOCAL_ORACLE_INPUT = extractArg('--local-oracle', rawArgs) || '';
const CURRENT_BLOCKER_INPUT = extractArg('--current-blocker', rawArgs) || '';
const NEXT_FORCED_BET_INPUT = extractArg('--next-forced-bet', rawArgs) || '';
const LAST_EVIDENCE_INPUT = extractArg('--last-evidence', rawArgs) || '';
const EVIDENCE_DELTA_INPUT = extractArg('--evidence-delta', rawArgs) || '';
const ACTUAL_DURATION_MIN = extractArg('--actual-duration-min', rawArgs) || '';
const RETRY_COUNT = extractArg('--retry-count', rawArgs) || '';
const WHAT_WAS_DONE = extractArg('--what-was-done', rawArgs) || '';
const WHAT_WAS_NOT_DONE = extractArg('--what-was-not-done', rawArgs) || '';
const VERIFICATION_EVIDENCE = extractArg('--verification-evidence', rawArgs) || '';
const TASK_ARGS_CLEAN = stripFlagValues(rawArgs, new Set([
  '--mode', '--complexity', '--result-status', '--failure-type', '--evidence-artifact',
  '--final-oracle', '--local-oracle', '--current-blocker', '--next-forced-bet', '--last-evidence',
  '--evidence-delta', '--actual-duration-min', '--retry-count', '--what-was-done', '--what-was-not-done',
  '--verification-evidence'
]));
const taskDescriptionClean = TASK_ARGS_CLEAN.join(' ') || '';

if (!taskDescriptionClean) {
  console.error('❌ Usage: /harness [flags] <task description>\n   Flags: --mode <minimal|keyword|llm|llm-full> --complexity <0-10> --no-preflight --dry-run --consume-result --goal-closed');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// MODE VALIDATION
// ─────────────────────────────────────────────────────────────
const VALID_MODES = ['minimal', 'keyword', 'llm', 'llm-full'];
if (!VALID_MODES.includes(MODE_ARG)) {
  console.error(`❌ Invalid mode: ${MODE_ARG}. Valid: ${VALID_MODES.join('|')}`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// AGENT KEYWORDS (keyword fallback only — used in 'keyword' and 'minimal' modes)
// ─────────────────────────────────────────────────────────────
const AGENT_KEYWORDS = {
  'engineering-frontend-developer':    { keywords: ['react','vue','angular','ui','css','frontend','网页','前端','mobile','responsive','tailwind','sass'], weight: 1.0, category: 'engineering' },
  'engineering-backend-architect':     { keywords: ['api','database','schema','backend','后端','服务器','microservice','rest','graphql','endpoint'], weight: 1.0, category: 'engineering' },
  'engineering-security-engineer':     { keywords: ['security','auth','encryption','安全','渗透','漏洞','owasp','jwt','oauth','https'], weight: 1.2, category: 'engineering' },
  'engineering-test-engineer':         { keywords: ['test','qa','e2e','unit','integration','测试','自动化','vitest','jest','playwright'], weight: 1.0, category: 'engineering' },
  'engineering-devops-automator':      { keywords: ['ci/cd','deploy','pipeline','docker','kubernetes','devops','部署','容器','nginx','ssl','CI'], weight: 1.0, category: 'engineering' },
  'engineering-ai-engineer':          { keywords: ['ai','ml','machine learning','llm','rag','人工智能','大模型','机器学习','embedding','vector'], weight: 1.2, category: 'engineering' },
  'engineering-data-engineer':         { keywords: ['data pipeline','etl','spark','dbt','data lake','数据管道','数据工程','csv','json','pipeline'], weight: 1.0, category: 'engineering' },
  'engineering-mobile-app-builder':    { keywords: ['ios','android','mobile app','react native','flutter','移动端','APP','xcode','gradle'], weight: 1.0, category: 'engineering' },
  'engineering-senior-developer':     { keywords: ['senior','refactor','architecture','重构','资深','technical debt','性能优化','重构'], weight: 1.0, category: 'engineering' },
  'engineering-software-architect':    { keywords: ['software architect','system design','hld','architecture pattern','系统架构','系统设计'], weight: 1.2, category: 'engineering' },
  'engineering-database-optimizer':    { keywords: ['database','sql','postgres','mysql','mongodb','redis','数据库','performance','索引','查询优化'], weight: 1.0, category: 'engineering' },
  'engineering-technical-writer':       { keywords: ['documentation','docs','readme','wiki','swagger','openapi','文档','技术文档','changelog'], weight: 1.0, category: 'engineering' },
  'engineering-incident-response-commander': { keywords: ['incident','outage','p1','p2','故障','事故','on-call','报警'], weight: 1.2, category: 'engineering' },
  'design-ui-designer':                { keywords: ['ui','design','visual','figma','界面设计','UI设计','css','样式','组件'], weight: 1.0, category: 'design' },
  'design-ux-researcher':              { keywords: ['ux','user research','usability','调研','用户体验','交互','用户研究'], weight: 1.0, category: 'design' },
};

const ALL_DOMAIN_KEYWORDS = Object.values(AGENT_KEYWORDS).flatMap(a => a.keywords);

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔍 Analyzing task: ${taskDescriptionClean}`);
  console.log(`   Mode: ${MODE_ARG} | Complexity override: ${COMPLEXITY || 'auto'}\n`);

  // Token tracking init
  const tokenTrack = { mode: MODE_ARG, llmCalls: 0, estimatedTokens: 0, subagentEstimate: 0 };

  // Step 1: Discover project
  const project = await discoverProject(taskDescriptionClean);
  console.log(`📁 Project: ${project.displayName} | Repo: ${project.repoPath}`);

  // Step 1.5: CONTEXT ASSEMBLER (skipped in minimal mode)
  let contextPackagePath = null;
  if (MODE_ARG !== 'minimal') {
    try {
      contextPackagePath = await runContextAssembler(project.repoPath, taskDescriptionClean);
    } catch (e) {
      console.log(`   ⚠️  ContextAssembler failed (${e.message}), continuing without context package`);
    }
  }

  // Step 1.75: HARNESS PRE-FLIGHT CHECK (skipped in minimal mode, or with --no-preflight)
  if (MODE_ARG !== 'minimal' && !rawArgs.includes('--no-preflight')) {
    await preflightHarnessCheck(project.repoPath);
  }

  // Step 2: Repo scan (skip in minimal mode)
  let scan = null;
  let codemapPath = null;
  if (MODE_ARG !== 'minimal') {
    scan = await scanRepo(project.repoPath);
    tokenTrack.estimatedTokens += scan.srcFiles.length * 2; // trivial

    // Step 2.5: Build CodeMap (project structure index)
    const codemapArtifactDir = path.join(project.repoPath, 'harness', 'artifacts');
    await mkdir(codemapArtifactDir, { recursive: true });
    codemapPath = path.join(codemapArtifactDir, 'codemap.md');
    try {
      const codemapScript = path.join(SCRIPT_DIR, 'codemap.js');
      execSync(`node "${codemapScript}" "${project.repoPath}" --output "${codemapPath}"`, {
        timeout: 120,
        cwd: project.repoPath,
        env: {
          ...process.env,
          CODEMAP_CALLER: 'harness.js',
          CODEMAP_REQUESTED_BY: 'trinity-harness',
        },
      });
      console.log('📍 CodeMap generated: harness/artifacts/codemap.md');
    } catch (e) {
      console.warn('⚠️  CodeMap generation failed (non-fatal):', e.message);
      codemapPath = null;
    }
  }

  // Step 3: Complexity scoring (override or compute)
  const complexity = COMPLEXITY > 0 ? COMPLEXITY : (scan ? computeComplexity(taskDescriptionClean, scan) : 3);
  console.log(`\n📊 Complexity Score: ${complexity}/10 → Profile: ${scoreToProfile(complexity)}`);

  // Step 4: LLM analysis (skip in minimal/keyword modes)
  let llmResult = null;
  if (MODE_ARG === 'llm' || MODE_ARG === 'llm-full') {
    llmResult = await analyzeTaskWithLLM(taskDescriptionClean, project, scan);
    tokenTrack.llmCalls += 1;
    tokenTrack.estimatedTokens += 2500;
  } else {
    // keyword fallback
    llmResult = keywordAnalysis(taskDescriptionClean, scan);
    tokenTrack.estimatedTokens += 150;
  }

  // Step 5: Clarification (skip in minimal mode)
  if (MODE_ARG !== 'minimal' && llmResult.needsClarification) {
    const answer = await handleClarification(llmResult);
    if (answer === null) {
      console.log('\n⚠️  Clarification cancelled. Aborting.');
      process.exit(0);
    }
    if (MODE_ARG === 'llm' || MODE_ARG === 'llm-full') {
      llmResult = await analyzeTaskWithLLM(`${taskDescriptionClean} ${answer}`, project, scan);
      tokenTrack.llmCalls += 1;
    }
  }

  const previousMasterConfig = await readPreviousMasterConfig();

  // Step 6: Sprint plan
  const plan = await generateSprintPlan(taskDescriptionClean, project, llmResult, scan, complexity, tokenTrack, contextPackagePath, previousMasterConfig, codemapPath);

  // Step 7: Dispatch (skip when only consuming result/backfill)
  if (!DRY_RUN && !CONSUME_RESULT) {
    await dispatchSprints(plan, contextPackagePath);
  }
  if (!DRY_RUN) {
    await updateActive(project, taskDescriptionClean, plan);
  }

  // Step 8: Write master + report
  const dispatchTime = CONSUME_RESULT
    ? (previousMasterConfig?.dispatchTime || new Date().toISOString())
    : new Date().toISOString();
  const masterConfig = {
    project, taskDescription: taskDescriptionClean, llmResult, plan, complexity,
    tokenTrack,
    continueGate: plan.continueGate,
    executionResult: plan.executionResult,
    dispatchTime,
    lifecycle: {
      mode: CONSUME_RESULT ? 'result-consumed' : 'dispatch',
      consumedResult: CONSUME_RESULT,
      goalClosed: GOAL_CLOSED
    },
    version: 'harness.js v5-preview'
  };
  if (!DRY_RUN) {
    await writeFile(MASTER_CONFIG_FILE, JSON.stringify(masterConfig, null, 2));

    // Step 9: Write report + state artifact
    await writeContinueGateArtifact(masterConfig);
    await writePostTaskReport(masterConfig);

    // Step 10: Append round learning to repo AGENTS.md Learnings block
    await appendRoundLearning(project, taskDescriptionClean, plan);
  }

  printReport(project, taskDescriptionClean, llmResult, plan, complexity, tokenTrack);
}

// ─────────────────────────────────────────────────────────────
// STEP 1: Project discovery (v4 — no ACTIVE.md fallback)
// ─────────────────────────────────────────────────────────────
async function discoverProject(taskDescription) {
  const lower = taskDescription.toLowerCase();

  // Step A: TASKS.md (primary source)
  // Match rule: bidirectional substring check on full name + core (name stripped of parentheticals)
  try {
    const tasksContent = await readFile(TASKS_FILE, 'utf8');
    const entries = parseTASKS(tasksContent);
    for (const [name, info] of Object.entries(entries)) {
      const nm = name.toLowerCase();
      // Core = name stripped of parenthetical suffix: "WDG（...）" → "wdg"
      const core = nm.replace(/[（\uff08][^）\uff09]*[）\uff09]?\s*$/, '').trim();
      // Bidirectional match: handles both "WDG" in "WDG（...）" and "Pipi-go" in "Pipi-go（...）"
      const nameMatch = lower.includes(nm) || nm.includes(lower) ||
                        lower.includes(core)  || core.includes(lower);
      if (nameMatch) return { displayName: name, repoPath: info.repoPath || WORKSPACE, source: 'TASKS.md' };
      // Alias match
      if ((info.alias || []).some(a => lower.includes(a.toLowerCase()))) {
        return { displayName: name, repoPath: info.repoPath || WORKSPACE, source: 'TASKS.md' };
      }
    }
  } catch (_) {}

  // Step B: github-scan (secondary fallback — NO ACTIVE.md)
  const guessed = await inferProjectFromGithub(lower);
  if (guessed) return guessed;

  return { displayName: 'workspace', repoPath: WORKSPACE, source: 'default' };
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// parseTASKS — string-based parser for TASKS.md
// Avoids regex pitfalls with full-width ： and ** in char classes
// ─────────────────────────────────────────────────────────────
function parseTASKS(content) {
  const entries = {};
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.includes('**Project number') && (line.includes('\uff1a') || line.includes(':'))) {
      let name = null;
      let j = i + 1;
      while (j < lines.length && j < i + 6) {
        const cand = lines[j];
        if (cand.includes('**Project number')) break;
        if (cand.includes('**Project name')) {
          const marker = '**Project name';
          const afterMarker = cand.slice(cand.indexOf(marker) + marker.length + 1);
          name = afterMarker.trim().replace(/^[^\w\u4e00-\u9fa5]+/, '').trim();
          break;
        }
        j++;
      }
      let repoPath = null;
      let k = i + 1;
      while (k < lines.length && k < i + 8) {
        const cand = lines[k];
        if (cand.includes('**Project number')) break;
        const bq = cand.match(/`([^`]+)`/);
        if (bq) { repoPath = bq[1].trim(); break; }
        k++;
      }
      if (name && repoPath) entries[name] = { repoPath };
      i = k;
    } else {
      i++;
    }
  }
  return entries;
}

function sanitizeProjectQuery(text = '') {
  // Keep unicode letters/numbers; drop punctuation/noise.
  return String(text || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\-_]+/gu, '')
    .trim();
}

async function findRepoInGithubRoot(name) {
  try {
    const dirs = await readdir(GITHUB_ROOT);
    const normalized = name.toLowerCase().replace(/[_\s]+/g, '-');
    if (!normalized || normalized.length < 2) return null;
    for (const dir of dirs) {
      if (dir.startsWith('.')) continue; // ignore hidden dirs like .claude
      if (dir.toLowerCase().replace(/[_\s]+/g, '-').includes(normalized)) {
        const fullPath = path.join(GITHUB_ROOT, dir);
        const s = await stat(fullPath);
        if (s.isDirectory()) return fullPath;
      }
    }
  } catch (_) {}
  return null;
}

async function inferProjectFromGithub(lower) {
  try {
    const query = sanitizeProjectQuery(lower);
    // Empty / too-short / generic queries must NOT match arbitrary repos.
    if (!query || query.length < 2) return null;

    const dirs = await readdir(GITHUB_ROOT);
    for (const dir of dirs) {
      if (dir.startsWith('.')) continue; // ignore hidden dirs like .claude
      const normalized = dir.toLowerCase().replace(/[_\s]+/g, '-');
      if (normalized.includes(query) || query.includes(normalized)) {
        const fullPath = path.join(GITHUB_ROOT, dir);
        const s = await stat(fullPath);
        if (s.isDirectory()) return { displayName: dir, repoPath: fullPath, source: 'github-scan' };
      }
    }
  } catch (_) {}
  return null;
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// STEP 1.5: HARNESS PRE-FLIGHT CHECK (v4)
// ─────────────────────────────────────────────────────────────
/**
 * Check if the target repo has minimum Trinity harness files.
 * If missing: warn but continue (degraded mode with guardCmd='unknown').
 * Use --no-preflight to skip entirely (for quick experiments).
 */
async function preflightHarnessCheck(repoPath) {
  const minHarness = [
    'AGENTS.md',
    'harness/goal.md',
    'scripts/run_change_guard.sh',
  ];

  const missing = [];
  for (const file of minHarness) {
    try { await stat(path.join(repoPath, file)); } catch (_) { missing.push(file); }
  }

  if (missing.length > 0) {
    console.log('\n⚠️  HARNESS PRE-FLIGHT: Project not Trinity-initialized');
    console.log('   Missing: ' + missing.join(', '));
    console.log('   Recommendation: Initialize first:');
    console.log('     bash project-harness-guards/scripts/scaffold_harness.sh "$repoPath"');
    console.log('   Or run with --no-preflight to skip.\n');
  } else {
    console.log('   ✅ Minimum harness detected');
  }
}

// STEP 2: Repo scan (unchanged from v3, gated by mode)
// ─────────────────────────────────────────────────────────────
async function scanRepo(repoPath) {
  console.log(`🔬 Scanning repo: ${repoPath}`);

  let srcFiles = [];
  let codebaseType = 'unknown';
  let framework = 'plain';

  try {
    const output = execSync(
      `find "${repoPath}" -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.java" -o -name "*.cs" \\) ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" ! -path "*/__pycache__/*" ! -path "*/.venv/*" ! -path "*/site-packages/*" ! -path "*/.venv/*/" ! -path "*/site-packages/*/" 2>/dev/null`,
      { encoding: 'utf8', timeout: 15000 }
    );
    srcFiles = output.split('\n').filter(Boolean).slice(0, 80).map(f => {
      const rel = path.relative(repoPath, f);
      let lines = '?';
      try { lines = execSync(`wc -l < "${f}"`, { encoding: 'utf8', timeout: 5000 }).trim(); } catch (_) {}
      return { rel, lines: parseInt(lines) || 0 };
    });
  } catch (_) {}

  try {
    const pjRaw = execSync(`cat "${repoPath}/package.json" 2>/dev/null`, { encoding: 'utf8' });
    codebaseType = 'Node.js/TypeScript';
    const pj = JSON.parse(pjRaw);
    const deps = { ...pj.dependencies || {}, ...pj.devDependencies || {} };
    if (deps.fastify || deps['@fastify/static']) framework = 'Fastify';
    else if (deps.express) framework = 'Express';
    else if (deps.next) framework = 'Next.js';
    else if (deps.react) framework = 'React';
    else if (deps.vue) framework = 'Vue';
  } catch (_) {}

  try {
    if (execSync(`test -f "${repoPath}/go.mod" && echo yes`, { encoding: 'utf8' }).includes('yes')) {
      codebaseType = 'Go'; framework = 'Go stdlib';
    }
  } catch (_) {}
  try {
    if (execSync(`test -f "${repoPath}/requirements.txt" && echo yes`, { encoding: 'utf8' }).includes('yes')) {
      codebaseType = 'Python'; framework = 'Python';
    }
  } catch (_) {}

  // ── Python oracle discovery (P0 fix: find real test commands) ──
  let pythonTestCmd = 'none';
  try {
    // Check scripts/validate.sh (Trinity convention)
    if (execSync(`test -f "${repoPath}/scripts/validate.sh" && echo yes`, { encoding: 'utf8' }).includes('yes')) {
      pythonTestCmd = 'bash scripts/validate.sh';
    }
  } catch (_) {}
  if (pythonTestCmd === 'none') {
    try {
      // Check for Makefile with test target
      const makefileContent = execSync(`cat "${repoPath}/Makefile" 2>/dev/null`, { encoding: 'utf8' });
      if (/^test:/m.test(makefileContent) || /^validate:/m.test(makefileContent)) {
        pythonTestCmd = 'make test';
      }
    } catch (_) {}
  }
  if (pythonTestCmd === 'none') {
    try {
      // Check for pytest.ini, setup.cfg, pyproject.toml (implies pytest)
      const hasPytestConfig = execSync(
        `test -f "${repoPath}/pytest.ini" -o -f "${repoPath}/setup.cfg" -o -f "${repoPath}/pyproject.toml" && echo yes`,
        { encoding: 'utf8' }
      ).includes('yes');
      if (hasPytestConfig) {
        pythonTestCmd = 'PYTHONPATH=src python3 -m pytest -q';
      }
    } catch (_) {}
  }
  if (pythonTestCmd === 'none') {
    try {
      // Heuristic: tests/ directory exists with pytest-style files
      const hasTests = execSync(`test -d "${repoPath}/tests" && echo yes`, { encoding: 'utf8' }).includes('yes');
      if (hasTests) pythonTestCmd = 'PYTHONPATH=src python3 -m pytest -q';
    } catch (_) {}
  }

  const topFiles = [...srcFiles].filter(f => f.lines > 0).sort((a, b) => b.lines - a.lines).slice(0, 20);

  let buildCmd = 'unknown', testCmd = 'none';
  try {
    if (codebaseType === 'Node.js/TypeScript') {
      const pj = JSON.parse(execSync(`cat "${repoPath}/package.json"`, { encoding: 'utf8' }));
      buildCmd = pj.scripts?.build || 'npm run build';
      testCmd  = pj.scripts?.test  || 'npm test';
    } else if (codebaseType === 'Python') {
      // Use discovered Python oracle, or fall back to pytest heuristic
      testCmd = pythonTestCmd !== 'none' ? pythonTestCmd : 'python3 -m pytest -q';
      buildCmd = 'python3 -m py_compile';
    }
  } catch (_) {}

  let guardCmd = 'unknown';
  try {
    const rootGuardExists = execSync(`bash -lc 'test -f "${repoPath}/scripts/run_change_guard.sh" && echo yes || true'`, { encoding: 'utf8' }).includes('yes');
    const bundledGuardExists = execSync(`bash -lc 'test -f "${repoPath}/project-harness-guards/scripts/run_change_guard.sh" && echo yes || true'`, { encoding: 'utf8' }).includes('yes');
    if (rootGuardExists) guardCmd = 'bash scripts/run_change_guard.sh';
    else if (bundledGuardExists) guardCmd = 'bash project-harness-guards/scripts/run_change_guard.sh .';
  } catch (_) {}

  let localOracle = composeLocalOracle({ repoPath, buildCmd, testCmd, guardCmd });
  try {
    const trinityGuardExists = execSync(`bash -lc 'test -f "${repoPath}/scripts/run_trinity_guard.sh" && echo yes || true'`, { encoding: 'utf8' }).includes('yes');
    if (trinityGuardExists) {
      localOracle = 'bash scripts/run_trinity_guard.sh';
      if (guardCmd === 'unknown') guardCmd = localOracle;
    }
  } catch (_) {}

  const featuresBacklog = readFeaturesBacklog(repoPath);

  // P1-5: Discover + persist oracle to registry
  await updateOracleRegistry(repoPath, {
    discovered: localOracle,
    type: 'discovered'
  });
  const registry = await readOracleRegistry(repoPath);

  return { repoPath, codebaseType, framework, srcFiles, topFiles, buildCmd, testCmd, guardCmd, localOracle, featuresBacklog, registry };
}

function composeLocalOracle(scan, registry = null) {
  // P1-5: Priority — user-specified > registry > discovered > heuristic
  // 1. User-specified oracle (stored in registry as lastUserSpecified)
  if (registry?.lastUserSpecified && registry.lastUserSpecified !== 'project-local verification command not yet discovered') {
    return registry.lastUserSpecified;
  }
  // 2. Registry discovered oracle (last successful / last discovered)
  if (registry?.lastDiscovered && registry.lastDiscovered !== 'project-local verification command not yet discovered') {
    return registry.lastDiscovered;
  }
  // 3. Fall back to scan-derived commands
  const commands = [scan?.buildCmd, scan?.testCmd, scan?.guardCmd]
    .filter(Boolean)
    .filter(cmd => cmd !== 'unknown' && cmd !== 'none');
  const uniqueCommands = [...new Set(commands)];
  return uniqueCommands.length > 0
    ? uniqueCommands.join(' && ')
    : 'project-local verification command not yet discovered';
}

// ─────────────────────────────────────────────────────────────
// P1-5: ORACLE REGISTRY — persistent per-repo oracle memory
// Priority: user-specified > lastSuccessful > lastDiscovered
// ─────────────────────────────────────────────────────────────
/**
 * Read oracle registry for a repo.
 * Returns null if no registry exists yet.
 */
async function readOracleRegistry(repoPath) {
  const oracleFile = path.join(repoPath, 'harness', 'oracles', 'registry.json');
  try {
    const raw = await readFile(oracleFile, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Update oracle registry with discovered or user-specified oracle.
 * Called after scanRepo discovers an oracle, and after user provides one.
 *
 * @param {string} repoPath
 * @param {object} data  — { discovered, userSpecified?, lastSuccessful? }
 */
async function updateOracleRegistry(repoPath, data = {}) {
  // P1-5: oracle registry is always at <repoPath>/harness/oracles/registry.json
  const oracleDir  = path.join(repoPath, 'harness', 'oracles');
  const oracleFile = path.join(oracleDir, 'registry.json');
  try {
    await mkdir(oracleDir, { recursive: true });
  } catch (_) {}
  let existing = {};
  try {
    const raw = await readFile(oracleFile, 'utf8');
    existing = JSON.parse(raw);
  } catch (_) {}

  const updated = {
    ...existing,
    updatedAt: new Date().toISOString(),
    lastDiscovered: data.discovered || existing.lastDiscovered || null,
    lastUserSpecified: data.userSpecified || existing.lastUserSpecified || null,
    lastSuccessful: data.lastSuccessful || existing.lastSuccessful || null,
    history: [
      { at: new Date().toISOString(), type: data.type || 'discovered', value: data.discovered || data.userSpecified || null },
      ...(existing.history || [])
    ].slice(0, 20) // keep last 20 entries
  };

  // Remove nulls
  if (!updated.lastDiscovered) delete updated.lastDiscovered;
  if (!updated.lastUserSpecified) delete updated.lastUserSpecified;
  if (!updated.lastSuccessful) delete updated.lastSuccessful;

  await writeFile(oracleFile, JSON.stringify(updated, null, 2));
  console.log(`   🔮 Oracle registry updated: ${oracleFile}`);
  return updated;
}

function readFeaturesBacklog(repoPath) {
  const featuresPath = path.join(repoPath, 'features.json');
  try {
    const raw = execSync(`cat "${featuresPath}"`, { encoding: 'utf8', timeout: 5000 });
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.features)
        ? parsed.features
        : [];

    return entries.map((entry, index) => ({
      id: entry.id || `F-${String(index + 1).padStart(3, '0')}`,
      title: entry.title || `Feature ${index + 1}`,
      verify: entry.verify || '',
      passes: Boolean(entry.passes),
      status: normalizeFeatureStatus(entry),
      priority: Number.isFinite(entry.priority) ? entry.priority : index + 1,
      size: normalizeFeatureSize(entry.size),
      dependsOn: Array.isArray(entry.dependsOn) ? entry.dependsOn : [],
      notes: typeof entry.notes === 'string' ? entry.notes : '',
      acceptanceCriteria: normalizeAcceptanceCriteria(entry.acceptanceCriteria)
    }));
  } catch (_) {
    return [];
  }
}

function normalizeFeatureStatus(entry = {}) {
  if (entry.passes) return 'done';
  const raw = String(entry.status || '').trim().toLowerCase();
  if (['todo', 'doing', 'blocked', 'done', 'split_required'].includes(raw)) return raw;
  return 'todo';
}

function normalizeFeatureSize(size) {
  const raw = String(size || '').trim().toUpperCase();
  return ['S', 'M', 'L'].includes(raw) ? raw : '';
}

function normalizeAcceptanceCriteria(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => normalizeAcceptanceCriterion(item, index))
    .filter(Boolean);
}

function normalizeAcceptanceCriterion(item, index) {
  if (typeof item === 'string') {
    const title = item.trim();
    return title ? { id: `AC${index + 1}`, title, verify: '', negativeTest: '', evidence: '' } : null;
  }
  if (!item || typeof item !== 'object') return null;

  const title = String(item.title || item.summary || item.name || item.text || `Acceptance criterion ${index + 1}`).trim();
  if (!title) return null;

  return {
    id: String(item.id || `AC${index + 1}`),
    title,
    verify: String(item.verify || item.command || '').trim(),
    negativeTest: String(item.negativeTest || item.negative || '').trim(),
    evidence: String(item.evidence || item.evidenceHint || '').trim()
  };
}

function formatAcceptanceCriteriaMarkdown(criteria = []) {
  if (!Array.isArray(criteria) || criteria.length === 0) return '';
  return criteria.map(item => {
    const details = [
      item.verify ? `  - verify: \`${item.verify}\`` : '',
      item.negativeTest ? `  - negative: \`${item.negativeTest}\`` : '',
      item.evidence ? `  - evidence: ${item.evidence}` : ''
    ].filter(Boolean).join('\n');
    return details
      ? `- [${item.id}] ${item.title}\n${details}`
      : `- [${item.id}] ${item.title}`;
  }).join('\n');
}

function formatAcceptanceCriteriaInline(criteria = []) {
  if (!Array.isArray(criteria) || criteria.length === 0) return '';
  return criteria.map(item => {
    const parts = [item.title];
    if (item.verify) parts.push(`verify=${item.verify}`);
    if (item.negativeTest) parts.push(`negative=${item.negativeTest}`);
    return `[${item.id}] ${parts.join(' | ')}`;
  }).join('; ');
}

function joinOracleCommands(commands = []) {
  const unique = [...new Set(commands.map(cmd => String(cmd || '').trim()).filter(Boolean))];
  return unique.join(' && ');
}

function buildFeatureOracle(feature, scan) {
  if (!feature) return null;
  const criteria = feature.acceptanceCriteria || [];
  const criteriaCommands = criteria.flatMap(item => [item.verify, item.negativeTest]).filter(Boolean);
  const localOracle = joinOracleCommands([feature.verify, ...criteriaCommands])
    || scan?.localOracle
    || composeLocalOracle(scan, scan?.registry)
    || 'project-local verification command not yet discovered';
  const acceptanceSummary = formatAcceptanceCriteriaInline(criteria);
  const finalOracle = criteria.length > 0
    ? `Feature ${feature.id} (${feature.title}) is accepted only if all listed acceptance criteria pass: ${acceptanceSummary}. Local oracle: ${localOracle}`
    : `Live acceptance for feature ${feature.id} (${feature.title}) plus local oracle: ${localOracle}`;

  return {
    featureId: feature.id,
    featureTitle: feature.title,
    acceptanceCriteria: criteria,
    acceptanceSummary,
    localOracle,
    finalOracle
  };
}

function isFeatureReady(feature, featureMap) {
  if (!feature || feature.passes || feature.status === 'done' || feature.status === 'blocked') return false;
  return feature.dependsOn.every(depId => {
    const dep = featureMap.get(depId);
    return dep ? dep.passes || dep.status === 'done' : true;
  });
}

function selectNextFeature(backlog = []) {
  if (!Array.isArray(backlog) || backlog.length === 0) return null;
  const featureMap = new Map(backlog.map(item => [item.id, item]));
  const pending = backlog
    .filter(item => isFeatureReady(item, featureMap))
    .sort((a, b) => (a.priority - b.priority) || a.id.localeCompare(b.id));
  return pending[0] || null;
}

function evaluateStoryGate(feature) {
  if (!feature) return { splitRequired: false, reasons: [] };
  const reasons = [];
  if (feature.status === 'split_required') reasons.push('feature already marked as split_required');
  if (feature.size === 'L') reasons.push('feature size=L (too large for one bounded iteration)');
  if (feature.acceptanceCriteria.length > 5) reasons.push(`feature has ${feature.acceptanceCriteria.length} acceptance criteria (>5)`);
  return { splitRequired: reasons.length > 0, reasons };
}

function buildFeatureScope(feature) {
  if (!feature) return '';
  const verifySection = feature.verify
    ? `\n## Verification\n\`\`\`bash\n${feature.verify}\n\`\`\``
    : '';
  const notesSection = feature.notes
    ? `\n## Notes\n${feature.notes}`
    : '';
  const criteriaSection = feature.acceptanceCriteria.length > 0
    ? `\n## Acceptance Criteria\n${formatAcceptanceCriteriaMarkdown(feature.acceptanceCriteria)}`
    : '';
  return `Feature ${feature.id}: ${feature.title}${criteriaSection}${verifySection}${notesSection}`;
}

function applySplitRequiredGate(continueGate, feature, reasons = []) {
  const reasonText = reasons.join('; ');
  return {
    ...continueGate,
    roundOutcome: 'split_required',
    stopAllowed: 'yes',
    currentBlocker: `Selected feature ${feature.id} must be split before execution: ${reasonText}`,
    nextForcedBet: `Split feature ${feature.id} into smaller stories in features.json, then rerun /harness on the narrowed story.`,
    evidenceDelta: 'split-required',
    resultStatus: '⚠️ split_required',
    lastEvidence: continueGate.lastEvidence || `Story gate rejected ${feature.id}: ${reasonText}`
  };
}

// ─────────────────────────────────────────────────────────────
// STEP 3: COMPLEXITY SCORING CARD (NEW in v4)
// ─────────────────────────────────────────────────────────────
/**
 * Compute objective complexity score 0-10.
 * Called when --complexity is not provided (auto mode).
 * Can be overridden: --complexity 7
 */
function computeComplexity(taskDescription, scan) {
  const lower = taskDescription.toLowerCase();
  let score = 0;

  // ── Indicator 1: File count estimate ──────────────────────
  const multiFileSignals = [
    'multiple', 'several', '多个', '多个文件', 'multi-file',
    'across', '涉及多个', '分散在', '不同模块'
  ];
  const singleFileSignals = [
    '单文件', 'single file', '一个文件', '改一个字', '改错别字',
    '改端口', '改配置', '改注释'
  ];
  if (multiFileSignals.some(s => lower.includes(s))) score += 2;
  else if (singleFileSignals.some(s => lower.includes(s))) score += 0;
  else if (scan && scan.topFiles.length > 10) score += 1;

  // ── Indicator 2: Change magnitude ─────────────────────────
  const bigChangeSignals = ['重构', 'refactor', '重写', 'rewrite', '全面改造', '架构', '系统设计'];
  const medChangeSignals = ['改写', '实现', '新增功能', 'implement', '功能', 'feature'];
  const smallChangeSignals = ['改', 'fix', 'bug', '修复', '改错', 'update', '调整', '优化'];
  if (bigChangeSignals.some(s => lower.includes(s))) score += 3;
  else if (medChangeSignals.some(s => lower.includes(s))) score += 2;
  else if (smallChangeSignals.some(s => lower.includes(s))) score += 1;

  // ── Indicator 3: Domain breadth ──────────────────────────
  const domains = ['frontend', 'backend', 'database', 'devops', 'security', 'design'];
  const domainCount = domains.filter(d => lower.includes(d)).length;
  score += Math.min(2, domainCount);

  // ── Indicator 4: Risk signals ─────────────────────────────
  const highRiskSignals = ['认证', 'auth', '支付', 'payment', 'deploy', 'production', '数据库迁移', '破坏性', 'destructive'];
  const mediumRiskSignals = ['api', '接口', '路由', '状态', 'data'];
  if (highRiskSignals.some(s => lower.includes(s))) score += 2;
  else if (mediumRiskSignals.some(s => lower.includes(s))) score += 1;

  // ── Indicator 5: Multi-agent signals ──────────────────────
  const multiAgentSignals = ['双方', '多角色', 'multi-agent', '前后端', 'frontend+backend', 'ui+api'];
  if (multiAgentSignals.some(s => lower.includes(s))) score += 2;

  return Math.min(10, Math.max(0, score));
}

/** Map complexity score → harness profile */
function scoreToProfile(complexity) {
  if (complexity <= 2) return 'Solo';
  if (complexity <= 4) return 'Solo/PG';
  if (complexity <= 6) return 'PG/PGE-final';
  return 'PGE-sprint';
}

/** Map complexity → attachment strategy */
function scoreToAttachmentTier(complexity) {
  if (complexity <= 2) return 'minimal';
  if (complexity <= 4) return 'standard';
  return 'full';
}

// ─────────────────────────────────────────────────────────────
// STEP 4: LLM analysis + keyword fallback
// ─────────────────────────────────────────────────────────────
async function analyzeTaskWithLLM(taskDescription, project, scan) {
  const prompt = buildLLMPrompt(taskDescription, project, scan);

  const apiUrl = process.env.OPENAI_API_URL || process.env.LLM_API_URL || 'https://api.openai.com/v1';
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '';
  const model  = process.env.HARNESS_LLM_MODEL || 'gpt-5';

  if (!apiKey) {
    console.log('   ⚠️  No API key — falling back to keyword analysis');
    return keywordAnalysis(taskDescription, scan);
  }

  try {
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [
        { role: 'system', content: SYSTEM_PROMPT_V4 },
        { role: 'user', content: prompt }
      ], temperature: 0.3, max_tokens: 2000 })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    return parseLLMResult(raw, taskDescription, project, scan);
  } catch (e) {
    console.log(`   ⚠️  LLM call failed (${e.message}), falling back to keyword`);
    return keywordAnalysis(taskDescription, scan);
  }
}

function keywordAnalysis(taskDescription, scan) {
  const lower = taskDescription.toLowerCase();
  const domainMatches = ALL_DOMAIN_KEYWORDS.filter(k => lower.includes(k)).length;
  const taskType = domainMatches > 3 ? 'fullstack' : domainMatches > 1 ? 'multi' : 'single';

  return {
    taskProfile: {
      taskType,
      subTaskTypes: [],
      skillsNeeded: [],
      agentSuggestions: [],
      complexity: Math.min(5, Math.max(2, Math.round(domainMatches * 0.8 + 1.5))),
      riskLevel: lower.includes('deploy') || lower.includes('支付') ? 'high' : 'medium',
      scopeGuess: 'multi-file'
    },
    enhancedBrief: scan
      ? `代码库: ${scan.codebaseType} / ${scan.framework}。主要文件: ${scan.topFiles.slice(0, 5).map(f => f.rel).join(', ')}。`
      : `请基于实际文件结构工作，不要假设。`,
    needsClarification: false,
    clarificationQuestions: [],
    isMultiAgent: false,
    agentPlan: null
  };
}

function buildLLMPrompt(taskDescription, project, scan) {
  const topFilesStr = scan
    ? scan.topFiles.slice(0, 15).map(f => `- \`${f.rel}\` (${f.lines} lines)`).join('\n')
    : '(repo scan skipped in keyword mode)';

  return `## Task
"${taskDescription}"

## Project
- Name: ${project.displayName}
- Repo: ${project.repoPath}
${scan ? `- Codebase: ${scan.codebaseType} | Framework: ${scan.framework}` : ''}

## Repo Structure (top files)
${topFilesStr}

## Output Format — MUST be valid JSON only, no markdown fences:
{
  "taskProfile": {
    "taskType": "single | multi | fullstack | infra | security | docs | refactor",
    "skillsNeeded": ["skill1","skill2"],
    "agentSuggestions": ["agent-id from: engineering-frontend-developer, engineering-backend-architect, engineering-security-engineer, engineering-test-engineer, engineering-devops-automator, engineering-ai-engineer, engineering-data-engineer, engineering-mobile-app-builder, engineering-senior-developer, engineering-software-architect, engineering-database-optimizer, engineering-technical-writer, design-ui-designer, design-ux-researcher"],
    "complexity": 1-5,
    "riskLevel": "low | medium | high",
    "scopeGuess": "single-file | multi-file | cross-layer"
  },
  "enhancedBrief": "3-5 Chinese sentences: what the subagent must know about this codebase",
  "needsClarification": true|false,
  "clarificationQuestions": [{"field":"...","question":"...","critical":true|false,"options":null}],
  "isMultiAgent": true|false,
  "agentPlan": [{"sprintId":"sprint-1","role":"agent-id","scope":"...","dependsOn":[]}]|null
}`;
}

const SYSTEM_PROMPT_V4 = `You are a senior software architect. Output ONLY valid JSON.
- needsClarification=true ONLY when critical info missing (project name, game rules, etc.)
- Default to one bounded story per round
- isMultiAgent=true ONLY when there are clearly independent stories that can run in parallel without shared state conflicts
- complexity 1=trivial(改错别字), 3=medium(单功能), 5=architecture-changing
- riskLevel: high if involves auth/payments/deploy
- agentSuggestions: pick best match from listed IDs only`;

function parseLLMResult(raw, taskDescription, project, scan) {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  let data;
  try { data = JSON.parse(cleaned); } catch (_) {
    return keywordAnalysis(taskDescription, scan);
  }
  if (!data.taskProfile || typeof data.taskProfile.complexity !== 'number') {
    return keywordAnalysis(taskDescription, scan);
  }
  return {
    taskProfile: data.taskProfile,
    enhancedBrief: data.enhancedBrief || '',
    needsClarification: data.needsClarification || false,
    clarificationQuestions: data.clarificationQuestions || [],
    isMultiAgent: data.isMultiAgent || false,
    agentPlan: data.agentPlan || null,
    raw
  };
}

// ─────────────────────────────────────────────────────────────
// STEP 4.5: AGENCY AGENT DECISION TREE (NEW in v4)
// ─────────────────────────────────────────────────────────────
/**
 * Decision tree for agent selection (replaces keyword-only in llm/llm-full modes).
 * Uses action-verb × target-type matrix.
 */
function agencyDecisionTree(taskDescription, llmResult, complexity) {
  const lower = taskDescription.toLowerCase();

  // ── Action verb extraction ────────────────────────────────
  const actionPatterns = [
    { verb: 'implement',   patterns: ['implement', '实现', '新增', '添加功能', '做功能'] },
    { verb: 'fix',         patterns: ['fix', '修复', '修 bug', '解决', '错误', '报错'] },
    { verb: 'refactor',    patterns: ['refactor', '重构', '重写', '优化代码', '整理'] },
    { verb: 'design',      patterns: ['design', '设计', '架构', '规划'] },
    { verb: 'test',        patterns: ['test', '测试', '自动化', 'e2e'] },
    { verb: 'deploy',      patterns: ['deploy', '部署', '上线', '发布', 'ci/cd', 'cicd'] },
    { verb: 'secure',      patterns: ['security', '安全', 'auth', '认证', '权限'] },
    { verb: 'document',    patterns: ['doc', '文档', 'readme', '注释', 'changelog'] },
    { verb: 'analyze',     patterns: ['analyze', '分析', '研究', '调研', 'review'] },
    { verb: 'build_ui',    patterns: ['ui', '界面', '前端', 'frontend', '样式', 'css', '组件'] },
  ];

  // ── Target type extraction ────────────────────────────────
  const targetPatterns = [
    { type: 'frontend', patterns: ['frontend', '前端', 'react', 'vue', 'angular', 'html', 'css', 'ui', '界面', '组件'] },
    { type: 'backend',   patterns: ['backend', '后端', 'api', 'server', 'endpoint', '路由', 'controller'] },
    { type: 'database',  patterns: ['database', '数据库', 'sql', 'mongodb', 'redis', 'schema', 'migration'] },
    { type: 'devops',    patterns: ['devops', 'ci/cd', 'docker', 'k8s', 'deploy', 'nginx', 'ssl', '部署'] },
    { type: 'security',  patterns: ['security', '安全', 'auth', 'jwt', 'oauth', '加密', '权限'] },
    { type: 'ai',        patterns: ['ai', 'ml', 'llm', '大模型', 'embedding', 'rag', '人工智能'] },
    { type: 'mobile',    patterns: ['mobile', 'ios', 'android', 'react native', 'flutter', 'app'] },
    { type: 'data',      patterns: ['data', 'etl', 'pipeline', 'csv', 'analytics', '数据'] },
  ];

  // Match action
  let action = null;
  for (const ap of actionPatterns) {
    if (ap.patterns.some(p => lower.includes(p))) { action = ap.verb; break; }
  }

  // Match target types
  let targets = [];
  for (const tp of targetPatterns) {
    if (tp.patterns.some(p => lower.includes(p))) targets.push(tp.type);
  }
  targets = [...new Set(targets)]; // deduplicate

  // ── Matrix routing ──────────────────────────────────────
  const matrix = {
    'implement|frontend':  'engineering-frontend-developer',
    'implement|backend':   'engineering-backend-architect',
    'implement|database':  'engineering-database-optimizer',
    'implement|ai':        'engineering-ai-engineer',
    'implement|mobile':     'engineering-mobile-app-builder',
    'implement|devops':    'engineering-devops-automator',
    'implement|*':          'engineering-senior-developer',
    'fix|frontend':        'engineering-frontend-developer',
    'fix|backend':         'engineering-backend-architect',
    'fix|security':        'engineering-security-engineer',
    'fix|database':        'engineering-database-optimizer',
    'fix|*':               'engineering-senior-developer',
    'refactor|*':          'engineering-senior-developer',
    'design|*':            'engineering-software-architect',
    'test|*':              'engineering-test-engineer',
    'deploy|*':            'engineering-devops-automator',
    'secure|*':            'engineering-security-engineer',
    'document|*':          'engineering-technical-writer',
    'analyze|frontend':    'design-ux-researcher',
    'analyze|ai':          'engineering-ai-engineer',
    'analyze|*':           'engineering-senior-developer',
    'build_ui|*':          'design-ui-designer',
  };

  // Fall back to most specific match
  let agent = null;
  if (targets.length > 0) {
    const key1 = `${action}|${targets[0]}`;
    const key2 = `${action}|*`;
    agent = matrix[key1] || matrix[key2] || null;
  } else {
    agent = matrix[`${action || 'implement'}|*`] || 'engineering-senior-developer';
  }

  // Use LLM suggestion if available and confidence is higher
  const llmSuggestion = llmResult?.taskProfile?.agentSuggestions?.[0];
  if (llmSuggestion && (!agent || complexity >= 5)) {
    agent = llmSuggestion; // LLM wins for complex tasks
  }

  // Fallback
  if (!agent) agent = 'engineering-senior-developer';

  const category = AGENT_KEYWORDS[agent]?.category || 'engineering';
  return {
    id: agent,
    confidence: llmSuggestion ? 85 : 70,
    category,
    file: `skills/agency-agents-lib/agents/${category}/${agent}.md`
  };
}

// ─────────────────────────────────────────────────────────────
// STEP 4b: Clarification (unchanged from v3)
// ─────────────────────────────────────────────────────────────
async function handleClarification(llmResult) {
  const questions = (llmResult.clarificationQuestions || []).filter(q => q.critical);
  if (questions.length === 0) return 'ok';

  console.log('\n' + '⚠️  '.repeat(40));
  console.log('需要明确以下信息：');
  questions.forEach((q, i) => {
    console.log(`  ${i + 1}. ${q.question}`);
    if (q.options) console.log(`     选项: ${q.options.join(' | ')}`);
  });
  console.log('⚠️  '.repeat(40));
  console.log('\n请回复信息，例如："项目是 MyProject，游戏是对抗模式"');
  console.log('（注意：此交互需在主 agent 会话中完成，此处仅记录需求）\n');

  const clarFile = path.join(WORKSPACE, '.harness-clarification-pending.json');
  await writeFile(clarFile, JSON.stringify({
    questions,
    taskDescription,
    timestamp: new Date().toISOString()
  }, null, 2));
  return 'ok';
}

// ─────────────────────────────────────────────────────────────
// STEP 5: Sprint plan (updated for v4)
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// INTENT MODE DETECTION (P0 fix — prevents backlog from hijacking task semantics)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// P1-6: REPO TRUTH GATHERING — read ACTIVE/goal/features BEFORE scan drives decisions
// ─────────────────────────────────────────────────────────────
/**
 * Gather project ground-truth from the repo itself.
 * These override whatever the scanner might infer.
 * Called at the start of generateSprintPlan() — BEFORE intent detection.
 */
async function gatherRepoTruth(repoPath) {
  const [activeRaw, goalRaw] = await Promise.all([
    readFile(path.join(repoPath, 'ACTIVE.md'), 'utf8').catch(() => null),
    readFile(path.join(repoPath, 'harness', 'goal.md'), 'utf8').catch(() => null),
  ]);

  // Parse ACTIVE.md for current task context
  let activeTask = null;
  let activeFeature = null;
  let activeStatus = null;
  if (activeRaw) {
    const taskMatch = activeRaw.match(/[\*\-]\s*\*\*Task\*\*:?\s*(.+)/i);
    const featMatch = activeRaw.match(/Selected Story:\s*([F-]?\d+)/i);
    const statMatch = activeRaw.match(/Status:\s*(\w+)/i);
    if (taskMatch) activeTask = taskMatch[1].trim();
    if (featMatch) activeFeature = featMatch[1].trim();
    if (statMatch) activeStatus = statMatch[1].trim();
  }

  // Parse goal.md for current objective
  let goalText = null;
  if (goalRaw) {
    // Extract first non-empty, non-heading line as goal summary
    const lines = goalRaw.split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (t && !t.startsWith('#') && !t.startsWith('>')) {
        goalText = t.slice(0, 120);
        break;
      }
    }
  }

  return {
    activeTask,
    activeFeature,
    activeStatus,
    goalText,
    hasActive: !!activeRaw,
    hasGoal: !!goalRaw
  };
}

/**
 * Detect the task's intent mode BEFORE selecting a feature.
 * This is the first line of defense against backlog-driven dispatch.
 *
 * P1-6: Now also considers repoTruth (ACTIVE/goal state) when resolving
 * unclear cases — the ACTIVE state can inform "continue current" intent.
 *
 * Modes:
 *   explicit_story      — User explicitly named a feature ID (F-001, F-002…)
 *   explicit_continue   — User said "continue F-XXX" or "继续 F-XXX"
 *   milestone_rollout   — User wants a full PRD / all features / whole project
 *   full_rollout        — User said "完成 PRD" / "全功能" / "整个项目"
 *   repo_wide           — Repo-wide operation (init, scaffold, audit)
 *   unclear              — Ambiguous; fall back to backlog only if backlog is healthy
 */
function detectIntentMode(taskDescription, scan, repoTruth = null) {
  const lower = taskDescription.toLowerCase();

  // Pattern: explicit feature ID mentions
  const explicitFeatureMatch = taskDescription.match(/\bF-?(\d{2,3})\b/i) || taskDescription.match(/feature[_-]?(\d{2,3})\b/i);
  const explicitFeatureId = explicitFeatureMatch
    ? `F-${String(explicitFeatureMatch[1]).padStart(3, '0')}`
    : null;

  // Directive: "continue / 继续 / 下一步 / 做完" + feature
  // NOTE: \b word boundary does NOT work with CJK characters — use bare substring for Chinese
  const continuePattern = /(\bcontinue[d]?\b|继续|下一步|做完|不要停在|不要做|别做|不要只做)/i;
  const hasDirective = continuePattern.test(taskDescription);

  // Milestone / full project keywords
  const fullRolloutKeywords = [
    '完成 prd', '全功能', '整个项目', '所有功能', '全部功能',
    'complete prd', 'full project', 'all features', 'whole project',
    '项目立项', '初始化项目', '项目启动', '新项目',
    '全面', '整体', '端到端', 'end to end',
  ];
  const hasFullRolloutIntent = fullRolloutKeywords.some(kw => lower.includes(kw));

  // Repo-wide operations (scaffold, init, audit — NOT feature dispatch)
  // NOTE: "init whole project" should be full_rollout, not repo_wide — more specific
  const repoWideKeywords = [
    'scaffold new', 'init new project', 'audit', '巡检', '检查',
    '项目巡检', '代码审计', '健康检查',
  ];
  const hasRepoWideIntent = repoWideKeywords.some(kw => lower.includes(kw));

  // Repo-size and breadth signals must BOTH be present before we infer full-rollout.
  const isComplexRepo = Boolean(scan && scan.topFiles && scan.topFiles.length > 5);
  const breadthKeywords = ['多个', '全面', '完整', '整个', '所有', 'multiple', 'full', 'complete'];
  const hasBreadthSignal = breadthKeywords.some(kw => lower.includes(kw));

  // Generic inspection / exploratory asks are NOT rollout intent.
  const exploratoryKeywords = [
    '看看', '看一下', '帮我看看', '看看这个项目', '看看项目', '看这个项目',
    'inspect', 'take a look', 'look at', 'review this project', 'look through'
  ];
  const hasExploratoryIntent = exploratoryKeywords.some(kw => lower.includes(kw));

  // ── Decision tree (order matters!) ───────────────────────────
  // Priority 1: explicit feature + directive → explicit_continue (MUST be first)
  if (explicitFeatureId && hasDirective) {
    return { mode: 'explicit_continue', explicitFeatureId, directive: 'continue' };
  }
  // Priority 2: explicit feature without directive
  if (explicitFeatureId) {
    return { mode: 'explicit_story', explicitFeatureId, directive: null };
  }
  // Priority 3: directive without explicit feature
  if (hasDirective) {
    return { mode: 'unclear_but_has_directive', explicitFeatureId: null, directive: 'directive_without_feature_id' };
  }
  // Priority 4: explicit exploratory / inspection asks stay unclear, even on large repos
  if (hasExploratoryIntent) {
    return { mode: 'unclear', explicitFeatureId: null, directive: 'exploratory' };
  }
  // Priority 5: full rollout needs explicit rollout keywords OR broad wording on a complex repo
  if (hasFullRolloutIntent || (isComplexRepo && hasBreadthSignal && hasDirective === false)) {
    return { mode: 'full_rollout', explicitFeatureId: null, directive: null };
  }
  // Priority 6: repo-wide (audit, scaffold — NOT project implementation)
  if (hasRepoWideIntent) {
    return { mode: 'repo_wide', explicitFeatureId: null, directive: null };
  }
  // Fallback: unclear
  // P1-6: If repo has an active in-progress feature, unresolved tasks default to continuing it
  if (repoTruth?.activeFeature &&
      repoTruth?.activeStatus &&
      !['done', 'goal_closed'].includes(repoTruth.activeStatus)) {
    return {
      mode: 'explicit_continue',
      explicitFeatureId: repoTruth.activeFeature,
      directive: 'from_active',
      source: 'repo_truth'
    };
  }
  return { mode: 'unclear', explicitFeatureId: null, directive: null };
}

/**
 * Scope mismatch guard — the second line of defense.
 * Runs AFTER selectNextFeature() but BEFORE the feature is used.
 *
 * Returns an error object if there's a dangerous mismatch,
 * or null if the selection is safe to use.
 */
function detectScopeMismatch(intentMode, autoSelectedFeature, scan) {
  const { mode, explicitFeatureId } = intentMode;

  // CASE 1: User explicitly named a feature, but auto-selected a DIFFERENT one
  if (explicitFeatureId && autoSelectedFeature) {
    const autoId = autoSelectedFeature.id || '';
    // Normalize both forms: F-1 vs F-001
    const norm = id => id.replace(/^F-0*(\d+)$/i, (_, n) => `F-${n}`).toUpperCase();
    if (norm(explicitFeatureId) !== norm(autoId)) {
      return {
        severity: 'hard_error',
        message: `Scope mismatch: user explicitly asked for ${explicitFeatureId} but backlog auto-selected ${autoId}. ` +
          `Harness will honor the user's explicit intent and target ${explicitFeatureId}.`,
        overrideFeatureId: explicitFeatureId
      };
    }
  }

  // CASE 2: User said "don't stay on F-001" or "don't do F-001 only"
  // but auto-selected the blocked feature
  const taskLower = ''; // passed separately if needed
  const blockedPatterns = [/不要停在f-?\d+/i, /不要做f-?\d+/i, /别做f-?\d+/i, /不要只做f-?\d+/i];
  // We detect this from the task text — handled by caller passing `taskDescription`

  // CASE 3: full_rollout / milestone_rollout but auto-selected single feature
  // This is a soft warning (warn but allow override at continue gate level)
  if ((mode === 'full_rollout' || mode === 'milestone_rollout') && autoSelectedFeature) {
    return {
      severity: 'soft_warning',
      message: `Scope mismatch: task appears to be full-rollout/milestone-level but backlog auto-selected ` +
        `single feature ${autoSelectedFeature.id}. Consider expanding scope.`,
      overrideFeatureId: null // don't override — just warn
    };
  }

  // CASE 4: repo_wide mode — backlog selection is IRRELEVANT
  if (mode === 'repo_wide' && autoSelectedFeature) {
    return {
      severity: 'hard_error',
      message: `Scope mismatch: task is repo-wide (init/scaffold/audit) but backlog auto-selected ` +
        `${autoSelectedFeature.id}. Repo-wide tasks bypass feature backlog entirely.`,
      overrideFeatureId: null
    };
  }

  return null;
}

/**
 * Override the auto-selected feature using a scope mismatch result.
 * Returns the correct feature from the backlog, or null to disable feature-mode.
 */
function resolveFeatureFromMismatch(mismatch, scan) {
  if (!mismatch || mismatch.severity !== 'hard_error') return null;
  if (!mismatch.overrideFeatureId) return null; // mismatch but no override available

  const backlog = scan?.featuresBacklog || [];
  const targetId = mismatch.overrideFeatureId;
  const normalized = targetId.replace(/^F-0*(\d+)$/i, (_, n) => `F-${parseInt(n)}`);

  const resolved = backlog.find(f => {
    const fid = (f.id || '').replace(/^F-0*(\d+)$/i, (_, n) => `F-${parseInt(n)}`);
    return fid === normalized;
  });

  return resolved || null;
}

// ─────────────────────────────────────────────────────────────
// P2-8: SCOPE SELECTION REASON — explain why this scope was chosen
// ─────────────────────────────────────────────────────────────
/**
 * Build a structured explanation of WHY this scope was selected.
 * Written to: plan.scopeSelectionReason + master brief + sprint brief.
 *
 * Intent-mode → backlog decision → selected scope → one-line why
 */
function buildScopeSelectionReason(intentMode, scopeMismatch, autoSelectedFeature, nextFeature, scan, repoTruth) {
  const backlog = scan?.featuresBacklog || [];
  const backlogSummary = `${backlog.filter(f => !f.passes && f.status !== 'done').length} unfinished / ${backlog.length} total`;

  // Backlog decision: used, ignored, overridden
  let backlogDecision = 'none';
  let backlogWhy = '';
  if (scopeMismatch) {
    if (scopeMismatch.severity === 'hard_error') {
      if (scopeMismatch.overrideFeatureId) {
        backlogDecision = 'overridden';
        backlogWhy = `backlog auto-selected ${autoSelectedFeature?.id || '?'} but user explicitly asked for ${scopeMismatch.overrideFeatureId}`;
      } else {
        backlogDecision = 'ignored';
        backlogWhy = `${intentMode.mode} tasks bypass backlog feature selection`;
      }
    } else {
      backlogDecision = 'used';
      backlogWhy = `scope mismatch warning only — continuing with auto-selected ${nextFeature?.id || 'none'}`;
    }
  } else if (nextFeature) {
    backlogDecision = 'used';
    backlogWhy = `backlog returned ${nextFeature.id} as highest-priority pending feature (${backlogSummary})`;
  } else {
    backlogDecision = 'none';
    backlogWhy = `no pending features in backlog (${backlogSummary})`;
  }

  // Intent resolution summary
  let intentWhy = '';
  if (intentMode.explicitFeatureId) {
    intentWhy = `user explicitly named ${intentMode.explicitFeatureId}`;
  } else if (intentMode.mode === 'explicit_continue') {
    intentWhy = `user gave continue directive; resolved to ${intentMode.explicitFeatureId || 'from repo truth'}`;
  } else if (intentMode.mode === 'repo_wide') {
    intentWhy = 'task is repo-wide (init/scaffold/audit) — no feature dispatch';
  } else if (intentMode.mode === 'full_rollout') {
    intentWhy = 'task signals full project / all features rollout';
  } else if (intentMode.directive === 'exploratory') {
    intentWhy = 'exploratory/inspection ask — no feature dispatch';
  } else if (repoTruth?.activeFeature && intentMode.directive === 'from_active') {
    intentWhy = `unclear task; repo truth shows active feature ${repoTruth.activeFeature} in progress`;
  } else if (repoTruth?.activeFeature) {
    intentWhy = `repo has in-progress feature ${repoTruth.activeFeature}`;
  } else {
    intentWhy = 'no explicit intent signal; defaulting to backlog if available';
  }

  const why = nextFeature
    ? `Selected ${nextFeature.id} (${nextFeature.title}) — ${intentWhy}. ${backlogWhy}.`
    : `No feature dispatched — ${intentWhy}. ${backlogWhy}.`;

  return {
    intentMode: intentMode.mode,
    explicitFeatureId: intentMode.explicitFeatureId || null,
    directive: intentMode.directive || null,
    source: intentMode.source || null,
    backlogDecision,
    backlogWhy,
    selectedFeatureId: nextFeature?.id || null,
    selectedFeatureTitle: nextFeature?.title || null,
    backlogSummary,
    why,
    scopeMismatchSeverity: scopeMismatch?.severity || null,
    scopeMismatchMessage: scopeMismatch?.message || null,
  };
}

// ─────────────────────────────────────────────────────────────
// P2-9: FEATURE QUEUE & MILESTONE QUEUE — explicit artifact output
// ─────────────────────────────────────────────────────────────
/**
 * Build a sorted list of pending features (excludes done/passing).
 * Returns: [{ id, title, priority, size, dependsOn, status }]
 */
function buildFeatureQueue(scan, currentFeatureId = null) {
  const backlog = scan?.featuresBacklog || [];
  return backlog
    .filter(f => !(f.passes || f.status === 'done'))
    .filter(f => !currentFeatureId || f.id !== currentFeatureId) // already dispatching → not in queue
    .sort((a, b) => (a.priority - b.priority) || (a.id < b.id ? -1 : 1))
    .map(f => ({
      id: f.id,
      title: f.title,
      priority: f.priority,
      size: f.size || null,
      dependsOn: f.dependsOn || [],
      status: f.status,
    }));
}

/**
 * Build a milestone queue from backlog.
 * For repos with explicit milestones: group features by milestone.
 * For flat feature lists: treat the whole list as one implied milestone.
 *
 * full_rollout / repo_wide → always emit; else → only if backlog has ≥3 pending.
 */
function buildMilestoneQueue(intentMode, scan) {
  const backlog = scan?.featuresBacklog || [];
  const pending = backlog.filter(f => !(f.passes || f.status === 'done'));

  // Only emit milestone queue in full/multi-feature modes, or when backlog is large enough
  const threshold = (intentMode.mode === 'full_rollout' || intentMode.mode === 'repo_wide') ? 1 : 3;
  if (pending.length < threshold) return null;

  // Detect explicit milestone field (some features.json use a milestone property)
  const hasExplicitMilestones = pending.some(f => f.milestone !== undefined && f.milestone !== null);

  if (hasExplicitMilestones) {
    const groups = {};
    for (const f of pending) {
      const m = String(f.milestone || 'default');
      if (!groups[m]) groups[m] = [];
      groups[m].push({ id: f.id, title: f.title, priority: f.priority, status: f.status });
    }
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([milestone, features]) => ({
        milestone,
        features: features.sort((a, b) => a.priority - b.priority),
        count: features.length,
      }));
  }

  // Flat list treated as single implied milestone
  return [{
    milestone: '(implied)',
    features: pending
      .sort((a, b) => (a.priority - b.priority) || (a.id < b.id ? -1 : 1))
      .map(f => ({ id: f.id, title: f.title, priority: f.priority, status: f.status })),
    count: pending.length,
  }];
}

// ─────────────────────────────────────────────────────────────
async function generateSprintPlan(taskDescription, project, llmResult, scan, complexity, tokenTrack, contextPackagePath, previousMasterConfig = null, codemapPath = null) {
  const sprints = [];
  const baseDir = path.join(HARNESS_DIR, 'contracts');
  await mkdir(baseDir, { recursive: true });

  // ── P1-6: Gather repo truth BEFORE intent detection — this is the decision priority ──
  const repoTruth = await gatherRepoTruth(project.repoPath);
  if (repoTruth.hasActive) {
    console.log(`   📌 Repo Truth: active feature=${repoTruth.activeFeature || 'none'} status=${repoTruth.activeStatus || 'unknown'}`);
  }

  // ── P0: Intent resolution — uses repoTruth to resolve unclear tasks ──
  const intentMode = detectIntentMode(taskDescription, scan, repoTruth);
  console.log(`\n🎯 Intent Mode: ${intentMode.mode}${intentMode.explicitFeatureId ? ` (explicit target: ${intentMode.explicitFeatureId})` : ''}`);

  // ── Backlog selection (only used in appropriate intent modes) ──
  const autoSelectedFeature = selectNextFeature(scan?.featuresBacklog || []);

  // ── P0: Scope mismatch guard — validate auto-selection against intent ──
  const scopeMismatch = detectScopeMismatch(intentMode, autoSelectedFeature, scan);
  if (scopeMismatch) {
    if (scopeMismatch.severity === 'hard_error') {
      console.warn(`\n🛑 SCOPE MISMATCH (hard error): ${scopeMismatch.message}`);
      // Override: use the correct feature from backlog
      const correctFeature = resolveFeatureFromMismatch(scopeMismatch, scan);
      if (correctFeature) {
        console.warn(`   → Overriding to user-specified ${correctFeature.id} (${correctFeature.title})`);
        // Replace autoSelectedFeature with correct one
        // We do this by reassigning — keep the const but the guard is logged
      } else if (intentMode.mode === 'repo_wide' || intentMode.mode === 'full_rollout') {
        console.warn(`   → Disabling feature mode for this round (repo-wide / full-rollout task)`);
      }
    } else {
      console.warn(`\n⚠️  SCOPE MISMATCH (soft warning): ${scopeMismatch.message}`);
    }
  }

  // Use intent-aware feature selection
  const nextFeature = resolveFeatureFromMismatch(scopeMismatch, scan) ||
    ((scopeMismatch?.severity === 'hard_error' && !scopeMismatch.overrideFeatureId)
      ? null
      : autoSelectedFeature);

  const featureGate = evaluateStoryGate(nextFeature);
  const featureOracle = nextFeature ? buildFeatureOracle(nextFeature, scan) : null;
  const baseTaskProfile = llmResult?.taskProfile || { taskType: 'single', riskLevel: 'medium', scopeGuess: 'multi-file' };
  const effectiveTaskProfile = nextFeature
    ? {
        ...baseTaskProfile,
        taskType: 'single',
        scopeGuess: nextFeature.dependsOn.length > 0 ? 'multi-file' : 'single-file'
      }
    : baseTaskProfile;
  const { taskType, riskLevel, scopeGuess } = effectiveTaskProfile;
  const matrixFlags = buildMatrixFlags(complexity, riskLevel, scopeGuess, llmResult, nextFeature, featureGate, featureOracle);

  // Agent selection: decision tree (llm mode) or keyword fallback
  const agent = MODE_ARG === 'minimal'
    ? { id: 'engineering-senior-developer', confidence: 50, category: 'engineering', file: 'skills/agency-agents-lib/agents/engineering/engineering-senior-developer.md' }
    : agencyDecisionTree(nextFeature ? `${nextFeature.title} ${nextFeature.notes}`.trim() : taskDescription, { ...llmResult, taskProfile: effectiveTaskProfile }, complexity);

  console.log(`\n🤖 Selected Agent: ${agent.id} (confidence: ${agent.confidence}%)`);
  if (nextFeature) console.log(`🎯 Selected Story: ${nextFeature.id} (${nextFeature.title})`);
  tokenTrack.subagentEstimate = nextFeature ? 1 : (complexity >= 7 ? 4 : complexity >= 4 ? 2 : 1);

  // Determine attachment tier
  const tier = scoreToAttachmentTier(complexity);
  const executionResult = deriveExecutionResult(previousMasterConfig);
  let continueGate = deriveContinueGate(
    nextFeature ? `${taskDescription} :: ${nextFeature.id}` : taskDescription,
    project,
    { ...llmResult, taskProfile: effectiveTaskProfile },
    scan,
    complexity,
    previousMasterConfig,
    executionResult,
    { feature: nextFeature, oracle: featureOracle }
  );
  if (nextFeature && featureGate.splitRequired) {
    continueGate = applySplitRequiredGate(continueGate, nextFeature, featureGate.reasons);
  }
  console.log(`📦 Attachment Tier: ${tier} (${tier === 'minimal' ? '无附件' : tier === 'standard' ? 'TEMPLATE_BRIEF only' : 'full 6-7 files'})`);

  // ── P2-8: Compute scope selection reason + queues (available for all return paths) ──
  const scopeSelectionReason = buildScopeSelectionReason(intentMode, scopeMismatch, autoSelectedFeature, nextFeature, scan, repoTruth);
  const featureQueue = buildFeatureQueue(scan, nextFeature?.id || null);
  const milestoneQueue = buildMilestoneQueue(intentMode, scan);

  if (nextFeature && featureGate.splitRequired) {
    const masterBrief = buildMasterBrief(project, scan, { ...llmResult, taskProfile: effectiveTaskProfile }, matrixFlags, agent, complexity, continueGate, featureOracle, scopeSelectionReason, featureQueue, milestoneQueue);
    return { sprints, masterBrief, matrixFlags, attachmentTier: tier, continueGate, executionResult, selectedFeature: nextFeature, featureOracle, scopeSelectionReason, featureQueue, milestoneQueue };
  }

  if (nextFeature) {
    const spec = {
      sprintId: nextFeature.id.toLowerCase(),
      role: agent.id,
      scope: buildFeatureScope(nextFeature),
      dependsOn: nextFeature.dependsOn || []
    };
    sprints.push({
      sprintId: spec.sprintId,
      role: spec.role,
      scope: spec.scope,
      dependsOn: spec.dependsOn,
      brief: buildSprintBrief(taskDescription, project, { ...llmResult, taskProfile: effectiveTaskProfile }, scan, spec, [], matrixFlags, agent, continueGate, codemapPath, featureOracle),
      agent,
      attachmentTier: tier
    });
  } else if (llmResult?.isMultiAgent && llmResult.agentPlan?.length > 0 && complexity >= 7) {
    for (const spec of llmResult.agentPlan) {
      sprints.push({
        sprintId: spec.sprintId,
        role: spec.role,
        scope: spec.scope,
        dependsOn: spec.dependsOn || [],
        brief: buildSprintBrief(taskDescription, project, { ...llmResult, taskProfile: effectiveTaskProfile }, scan, spec, sprints, matrixFlags, agent, continueGate, codemapPath, null),
        agent: selectAgentFromId(spec.role),
        attachmentTier: scoreToAttachmentTier(complexity)
      });
    }
  } else {
    const spec = { sprintId: 'sprint-1', role: agent.id, scope: taskDescription, dependsOn: [] };
    sprints.push({
      sprintId: spec.sprintId,
      role: spec.role,
      scope: spec.scope,
      dependsOn: [],
      brief: buildSprintBrief(taskDescription, project, { ...llmResult, taskProfile: effectiveTaskProfile }, scan, spec, [], matrixFlags, agent, continueGate, codemapPath, null),
      agent,
      attachmentTier: tier
    });
  }

  const masterBrief = buildMasterBrief(project, scan, { ...llmResult, taskProfile: effectiveTaskProfile }, matrixFlags, agent, complexity, continueGate, featureOracle, scopeSelectionReason, featureQueue, milestoneQueue);
  return { sprints, masterBrief, matrixFlags, attachmentTier: tier, continueGate, executionResult, selectedFeature: nextFeature, featureOracle, scopeSelectionReason, featureQueue, milestoneQueue };
}

function buildMatrixFlags(complexity, riskLevel, scopeGuess, llmResult, selectedFeature = null, featureGate = null, featureOracle = null) {
  const flags = [];
  if (complexity >= 7)  flags.push({ flag: 'COMPLEXITY_HIGH', note: `complexity=${complexity} — PGE-sprint enforced` });
  if (complexity >= 4)  flags.push({ flag: 'COMPLEXITY_MED', note: `complexity=${complexity} — consider multi-sprint` });
  if (riskLevel === 'high') flags.push({ flag: 'RISK_HIGH', note: 'L1 acceptance enforced — no L0 shortcuts' });
  if (scopeGuess === 'cross-layer' || scopeGuess === 'full-rewrite') flags.push({ flag: 'SCOPE_CROSS', note: `scope=${scopeGuess} — affects multiple layers` });
  if (selectedFeature) flags.push({ flag: 'SINGLE_STORY', note: `dispatch only feature ${selectedFeature.id} in this round` });
  if (featureOracle?.acceptanceCriteria?.length > 0) flags.push({ flag: 'FEATURE_ORACLE', note: `feature carries ${featureOracle.acceptanceCriteria.length} acceptance criteria into oracle chain` });
  if (featureGate?.splitRequired) flags.push({ flag: 'SPLIT_REQUIRED', note: featureGate.reasons.join('; ') });
  if (!selectedFeature && llmResult?.isMultiAgent) flags.push({ flag: 'MULTI_AGENT', note: 'multi-agent sprint plan generated' });
  return flags;
}

function buildMasterBrief(project, scan, llmResult, matrixFlags, agent, complexity, continueGate, featureOracle = null, scopeSelectionReason = null, featureQueue = null, milestoneQueue = null) {
  const flagSection = matrixFlags.length > 0
    ? `\n## Matrix Flags\n${matrixFlags.map(f => `- **[${f.flag}]** ${f.note}`).join('\n')}\n`
    : '';

  // P2-8: Scope selection reason section
  const scopeReasonSection = scopeSelectionReason ? `
## Why This Scope
- **Intent Mode**: ${scopeSelectionReason.intentMode}${scopeSelectionReason.directive ? ` (directive: ${scopeSelectionReason.directive})` : ''}
- **Backlog Decision**: ${scopeSelectionReason.backlogDecision} — ${scopeSelectionReason.backlogWhy}
- **Selection**: ${scopeSelectionReason.why}
${scopeSelectionReason.scopeMismatchSeverity ? `- **Scope Mismatch**: [${scopeSelectionReason.scopeMismatchSeverity.toUpperCase()}] ${scopeSelectionReason.scopeMismatchMessage || ''}` : ''}
` : '';

  // P2-9: Feature queue section
  const featureQueueSection = (featureQueue && featureQueue.length > 0) ? `\n## Feature Queue (next up)
${featureQueue.map(f => `- **[${f.id}]** ${f.title} | priority=${f.priority}${f.size ? ` size=${f.size}` : ''}${f.dependsOn?.length ? ` deps=${f.dependsOn.join(',')}` : ''}`).join('\n')}
` : (featureQueue !== null ? `\n## Feature Queue
_All features passing or none pending._\n` : '');

  // P2-9: Milestone queue section
  const milestoneQueueSection = (milestoneQueue && milestoneQueue.length > 0) ? `\n## Milestone Roadmap
${milestoneQueue.map(m => `### ${m.milestone === '(implied)' ? 'Feature Backlog (implied)' : m.milestone} (${m.count} features)\n${m.features.map(f => `- **[${f.id}]** ${f.title}`).join('\n')}`).join('\n')}
` : '';

  const continueGateSection = continueGate ? `
## Continue Gate (v5 preview)
- **Final Oracle**: ${continueGate.finalOracle}
- **Current Blocker**: ${continueGate.currentBlocker}
- **Round Outcome**: ${continueGate.roundOutcome}
- **Stop Allowed**: ${continueGate.stopAllowed}
- **Next Forced Bet**: ${continueGate.nextForcedBet}
- **Local Oracle**: ${continueGate.localOracle}
- **Evidence Delta**: ${continueGate.evidenceDelta}
- **Last Evidence**: ${continueGate.lastEvidence || 'none yet'}
- **Pivot Trigger**: ${continueGate.pivotAfterNoEvidenceRounds} no-evidence rounds on same branch
` : '';
  const featureOracleSection = featureOracle?.acceptanceCriteria?.length > 0 ? `
## Feature Oracle
- **Feature**: ${featureOracle.featureId} — ${featureOracle.featureTitle}
- **Acceptance Summary**: ${featureOracle.acceptanceSummary}
- **Feature Local Oracle**: ${featureOracle.localOracle}

### Acceptance Criteria
${formatAcceptanceCriteriaMarkdown(featureOracle.acceptanceCriteria)}
` : '';

  const brief = `# Architectural Brief — ${project.displayName}
> harness.js v5-preview | ${new Date().toISOString()}
> Mode: ${MODE_ARG} | Complexity: ${complexity}/10 | Profile: ${scoreToProfile(complexity)}

## 任务画像
- **类型**: ${llmResult?.taskProfile?.taskType || 'unknown'}
- **复杂度**: ${complexity}/10 → ${scoreToProfile(complexity)}
- **风险**: ${llmResult?.taskProfile?.riskLevel || 'medium'}
- **范围**: ${llmResult?.taskProfile?.scopeGuess || 'multi-file'}
- **Agent**: ${agent.id} (confidence: ${agent.confidence}%)
${flagSection}${scopeReasonSection}${continueGateSection}${featureOracleSection}${featureQueueSection}${milestoneQueueSection}

## 架构要点
${llmResult?.enhancedBrief || '无 LLM 分析（minimal/keyword 模式）'}

${scan ? `## 代码库
- **类型**: ${scan.codebaseType} | **框架**: ${scan.framework}
- **构建**: \`${scan.buildCmd}\` | **测试**: \`${scan.testCmd}\` | **Guard**: \`${scan.guardCmd}\`
- **Local Oracle**: \`${continueGate?.localOracle || scan.localOracle || 'project-local verification command not yet discovered'}\`

## 主要文件
${scan.topFiles.slice(0, 10).map(f => `- \`${f.rel}\` (${f.lines}L)`).join('\n')}
` : ''}`;
  return brief;
}

function buildSprintBrief(taskDescription, project, llmResult, scan, spec, priorSprints, matrixFlags, agent, continueGate = null, codemapPath = null, featureOracle = null) {
  const localOracle = featureOracle?.localOracle || continueGate?.localOracle || scan?.localOracle || '请参考项目实际构建命令';
  const featureAcceptanceSection = featureOracle?.acceptanceCriteria?.length > 0
    ? `\n\n## Feature Acceptance Criteria\n${formatAcceptanceCriteriaMarkdown(featureOracle.acceptanceCriteria)}\n\n**Feature Final Oracle**: ${featureOracle.finalOracle}`
    : '';
  const acceptanceSection = scan ? `## 验收\n\`\`\`bash\ncd "${project.repoPath}" && ${localOracle}\n\`\`\`${featureAcceptanceSection}` : `## 验收\n请参考项目实际构建命令${featureAcceptanceSection}`;

  const codemapSection = codemapPath
    ? `\n## 项目全貌（必读）\n执行任何操作前，请先阅读项目结构索引：\n\`\`\`\nharness/artifacts/codemap.md\n\`\`\`\n其中包含：模块依赖图、API 路由表、数据模型清单、跨目录引用。这些信息对理解代码传播路径和定位 bug 至关重要。\n`
    : '';

  const continueGateSection = continueGate ? `\n## Continue Gate (v5 preview)\n- **Final Oracle**: ${continueGate.finalOracle}\n- **Current Blocker**: ${continueGate.currentBlocker}\n- **Round Outcome**: ${continueGate.roundOutcome}\n- **Stop Allowed**: ${continueGate.stopAllowed}\n- **Next Forced Bet**: ${continueGate.nextForcedBet}\n- **Local Oracle**: ${continueGate.localOracle}\n- **Evidence Delta**: ${continueGate.evidenceDelta}\n- **No-Evidence Rounds**: ${continueGate.noEvidenceRounds}\n- **Last Evidence**: ${continueGate.lastEvidence || 'none yet'}\n- **Pivot Trigger**: ${continueGate.pivotAfterNoEvidenceRounds} no-evidence rounds on same branch\n` : '';

  return `# Sprint Contract — ${spec.sprintId}

## 任务\n${spec.scope}${codemapSection}

## 项目\n${project.displayName} | ${project.repoPath}

## Agent\n${spec.role}\n${matrixFlags.length > 0 ? `\n## Matrix Flags\n${matrixFlags.map(f => `- **[${f.flag}]** ${f.note}`).join('\n')}` : ''}${continueGateSection}

## 依赖\n${spec.dependsOn.length === 0 ? '_无_' : spec.dependsOn.map(d => `- ${d}`).join('\n')}

${acceptanceSection}

## 注意事项\n${llmResult?.enhancedBrief || ''}

---
*Generated: ${new Date().toISOString()}*`;
}

async function readPreviousMasterConfig() {
  try {
    const raw = await readFile(MASTER_CONFIG_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function normalizeTaskText(text = '') {
  return String(text).trim().toLowerCase().replace(/\s+/g, ' ');
}

function hasMeaningfulText(value = '') {
  const text = String(value || '').trim();
  if (!text) return false;
  const placeholderFragments = [
    'unknown && unknown',
    'run unknown and unknown',
    'project-local verification command not yet discovered',
    'Not yet verified against final oracle',
    '⬜ fill'
  ];
  return !placeholderFragments.some(fragment => text.includes(fragment));
}

function parseOptionalInteger(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function hasExplicitResultInput() {
  return [
    CONSUME_RESULT,
    GOAL_CLOSED,
    BLOCKED_EXTERNAL,
    BLOCKED_APPROVAL,
    RESULT_STATUS,
    FAILURE_TYPE,
    EVIDENCE_ARTIFACT,
    FINAL_ORACLE_INPUT,
    LOCAL_ORACLE_INPUT,
    CURRENT_BLOCKER_INPUT,
    NEXT_FORCED_BET_INPUT,
    LAST_EVIDENCE_INPUT,
    EVIDENCE_DELTA_INPUT,
    ACTUAL_DURATION_MIN,
    RETRY_COUNT,
    WHAT_WAS_DONE,
    WHAT_WAS_NOT_DONE,
    VERIFICATION_EVIDENCE
  ].some(Boolean);
}

function normalizeEvidenceArtifactPath(rawArtifact = '', repoPath = WORKSPACE) {
  const raw = String(rawArtifact || '').trim();
  if (!raw) return '';

  const normalized = raw.replace(/^\.\//, '');
  if (normalized.startsWith('harness/artifacts/') || normalized.startsWith('artifacts/')) return normalized;

  if (path.isAbsolute(normalized)) {
    const rel = path.relative(repoPath, normalized).replace(/\\/g, '/');
    if (!rel.startsWith('..')) return rel;
    return normalized;
  }

  if (!normalized.includes('/')) {
    return `harness/artifacts/${normalized}`;
  }

  return normalized;
}

function buildBranchKey(project, taskDescription) {
  return `${project.repoPath}::${normalizeTaskText(taskDescription)}`;
}

function deriveEvidenceFingerprint(taskDescription, llmResult, scan, complexity) {
  return JSON.stringify({
    task: normalizeTaskText(taskDescription),
    complexity,
    taskType: llmResult?.taskProfile?.taskType || 'unknown',
    riskLevel: llmResult?.taskProfile?.riskLevel || 'unknown',
    scopeGuess: llmResult?.taskProfile?.scopeGuess || 'unknown',
    buildCmd: scan?.buildCmd || null,
    guardCmd: scan?.guardCmd || null,
    localOracle: scan?.localOracle || null,
    topFiles: (scan?.topFiles || []).slice(0, 5).map(f => f.rel)
  });
}

function deriveExecutionResult(previousMasterConfig = null) {
  const previous = previousMasterConfig?.executionResult || {};
  const consumedAt = hasExplicitResultInput() ? new Date().toISOString() : (previous.consumedAt || '');

  return {
    status: RESULT_STATUS || previous.status || '',
    failureType: FAILURE_TYPE || previous.failureType || '',
    actualDurationMin: parseOptionalInteger(ACTUAL_DURATION_MIN) ?? previous.actualDurationMin ?? null,
    retryCount: parseOptionalInteger(RETRY_COUNT) ?? previous.retryCount ?? null,
    whatWasDone: WHAT_WAS_DONE || previous.whatWasDone || '',
    whatWasNotDone: WHAT_WAS_NOT_DONE || previous.whatWasNotDone || '',
    verificationEvidence: VERIFICATION_EVIDENCE || previous.verificationEvidence || '',
    consumedAt,
    consumedFrom: CONSUME_RESULT ? 'cli-backfill' : (previous.consumedFrom || '')
  };
}

function deriveContinueGate(taskDescription, project, llmResult, scan, complexity, previousMasterConfig = null, executionResult = null, featureContext = null) {
  const previousContinueGate = previousMasterConfig?.continueGate || {};
  const branchKey = buildBranchKey(project, taskDescription);
  const evidenceFingerprint = deriveEvidenceFingerprint(taskDescription, llmResult, scan, complexity);
  const previousBranchKey = previousContinueGate.branchKey || null;
  const previousFingerprint = previousContinueGate.evidenceFingerprint || null;
  const sameBranch = previousBranchKey === branchKey;
  const explicitResultInput = hasExplicitResultInput();

  let evidenceDelta = 'pending-first-round';
  let noEvidenceRounds = 0;

  if (EVIDENCE_DELTA_INPUT) {
    evidenceDelta = EVIDENCE_DELTA_INPUT;
    noEvidenceRounds = evidenceDelta === 'none'
      ? (sameBranch ? (previousContinueGate.noEvidenceRounds || 0) : 0)
      : 0;
  } else if (GOAL_CLOSED) {
    evidenceDelta = 'changed';
    noEvidenceRounds = 0;
  } else if (!previousMasterConfig || !sameBranch) {
    evidenceDelta = 'new-branch';
    noEvidenceRounds = 0;
  } else if (explicitResultInput) {
    evidenceDelta = previousContinueGate.evidenceDelta || 'changed';
    noEvidenceRounds = previousContinueGate.noEvidenceRounds || 0;
  } else if (previousFingerprint === evidenceFingerprint) {
    evidenceDelta = 'none';
    noEvidenceRounds = (previousContinueGate.noEvidenceRounds || 0) + 1;
  } else {
    evidenceDelta = 'changed';
    noEvidenceRounds = 0;
  }

  const pivotAfterNoEvidenceRounds = 2;
  let roundOutcome = noEvidenceRounds >= pivotAfterNoEvidenceRounds ? 'pivot_required' : 'retry_with_new_bet';
  if (!explicitResultInput && sameBranch && previousContinueGate.roundOutcome === 'goal_closed') {
    roundOutcome = 'goal_closed';
    evidenceDelta = previousContinueGate.evidenceDelta || evidenceDelta;
    noEvidenceRounds = 0;
  }
  if (GOAL_CLOSED) roundOutcome = 'goal_closed';
  if (BLOCKED_APPROVAL) roundOutcome = 'blocked_approval';
  if (BLOCKED_EXTERNAL) roundOutcome = 'blocked_external';

  const previousLocalOracle = hasMeaningfulText(previousContinueGate.localOracle) ? previousContinueGate.localOracle : '';
  const previousFinalOracle = hasMeaningfulText(previousContinueGate.finalOracle) ? previousContinueGate.finalOracle : '';
  const previousCurrentBlocker = hasMeaningfulText(previousContinueGate.currentBlocker) ? previousContinueGate.currentBlocker : '';
  const previousNextForcedBet = hasMeaningfulText(previousContinueGate.nextForcedBet) ? previousContinueGate.nextForcedBet : '';
  const selectedFeature = featureContext?.feature || null;
  const featureOracle = featureContext?.oracle || null;

  const localOracle = LOCAL_ORACLE_INPUT
    || featureOracle?.localOracle
    || previousLocalOracle
    || scan?.localOracle
    || composeLocalOracle(scan, scan?.registry)
    || 'project-local verification command not yet discovered';
  const finalOracle = FINAL_ORACLE_INPUT
    || featureOracle?.finalOracle
    || previousFinalOracle
    || `Live acceptance for \"${taskDescription}\" plus local oracle: ${localOracle}`;

  const currentBlocker = CURRENT_BLOCKER_INPUT
    || (roundOutcome === 'goal_closed'
      ? 'None — final oracle passed and the task can stop.'
      : roundOutcome === 'pivot_required'
        ? 'Same branch produced no meaningful new evidence for two consecutive rounds; pivot required.'
        : roundOutcome === 'blocked_approval'
          ? 'Execution hit an approval boundary that requires Boss approval before continuing.'
          : roundOutcome === 'blocked_external'
            ? 'Execution is blocked by an external/platform/tooling dependency.'
            : previousCurrentBlocker
              || 'Not yet verified against final oracle. Replace with concrete blocker after the first failed live check.');

  const nextForcedBet = NEXT_FORCED_BET_INPUT
    || (roundOutcome === 'goal_closed'
      ? 'None — record closure evidence, sync ACTIVE/report, and stop.'
      : roundOutcome === 'pivot_required'
        ? 'Change branch/approach now, inform Boss of the pivot, and continue without waiting for confirmation unless a new approval boundary appears.'
        : roundOutcome === 'blocked_approval'
          ? 'Pause execution at the approval boundary, notify Boss with the exact action awaiting approval, and resume after approval.'
          : roundOutcome === 'blocked_external'
            ? 'Record the external blocker with evidence, notify Boss, and switch to another executable branch or wait for the dependency to recover.'
            : previousNextForcedBet
              || (localOracle && localOracle !== 'project-local verification command not yet discovered'
                ? `Execute one bounded bet, then run ${localOracle}; if final oracle still fails, record evidence delta and launch the next repair step.`
                : 'Execute one bounded bet, verify against the real acceptance path, and if the final oracle still fails, record evidence delta and continue.'));

  const evidenceArtifact = normalizeEvidenceArtifactPath(
    EVIDENCE_ARTIFACT || previousContinueGate.evidenceArtifact || '',
    project.repoPath
  );
  const resultStatus = (GOAL_CLOSED ? '✅ done' : (RESULT_STATUS || previousContinueGate.resultStatus || executionResult?.status || ''));
  const failureType = FAILURE_TYPE || previousContinueGate.failureType || executionResult?.failureType || '';
  const lastEvidence = LAST_EVIDENCE_INPUT
    || (hasMeaningfulText(previousContinueGate.lastEvidence) ? previousContinueGate.lastEvidence : '')
    || executionResult?.verificationEvidence
    || (evidenceArtifact ? `Evidence recorded at ${evidenceArtifact}` : '');

  return {
    branchKey,
    evidenceFingerprint,
    finalOracle,
    currentBlocker,
    roundOutcome,
    stopAllowed: roundOutcome === 'goal_closed' || roundOutcome === 'blocked_approval' || roundOutcome === 'blocked_external' ? 'yes' : 'no',
    nextForcedBet,
    evidenceDelta,
    noEvidenceRounds,
    pivotAfterNoEvidenceRounds,
    localOracle,
    evidenceArtifact,
    resultStatus,
    failureType,
    lastEvidence,
    selectedFeatureId: selectedFeature?.id || '',
    selectedFeatureTitle: selectedFeature?.title || '',
    acceptanceCriteria: featureOracle?.acceptanceCriteria || [],
    acceptanceSummary: featureOracle?.acceptanceSummary || '',
    resultConsumedAt: executionResult?.consumedAt || '',
    explicitInputsApplied: explicitResultInput
  };
}

function selectAgentFromId(role) {
  const entry = Object.entries(AGENT_KEYWORDS).find(([id]) => id === role);
  if (!entry) return { id: role, confidence: 50, category: 'engineering', file: `skills/agency-agents-lib/agents/engineering/${role}.md` };
  return { id: entry[0], confidence: 80, category: entry[1].category, file: `skills/agency-agents-lib/agents/${entry[1].category}/${entry[0]}.md` };
}

// ─────────────────────────────────────────────────────────────
// STEP 6: SELECTIVE ATTACHMENTS (NEW in v4)
// ─────────────────────────────────────────────────────────────
/**
 * Build attachment list based on complexity tier.
 * minimal  → no attachments (only goal pointers in task message)
 * standard → TEMPLATE_BRIEF.md only
 * full     → 5-6 files
 */
function buildAttachments(agent, sprintBriefPath, sprintContractPath, tier, contextPackagePath = null) {
  // Context package always first (prepended for all non-minimal tiers)
  const contextFile = contextPackagePath
    ? [contextPackagePath.replace(process.cwd() + '/', '')]
    : [];

  if (tier === 'minimal') {
    return contextFile; // Context package only in minimal (better than nothing)
  }

  if (tier === 'standard') {
    return [
      ...contextFile,
      'skills/subagent-coding-lite/TEMPLATE_BRIEF.md',
      sprintContractPath
    ];
  }

  // full tier
  const files = [
    ...contextFile,
    'skills/dev-project-harness-loop/SKILL.md',
    'skills/subagent-coding-lite/SKILL.md',
    'skills/subagent-coding-lite/TEMPLATE_BRIEF.md',
    sprintContractPath
  ];

  // Add agent profile if exists
  try {
    // Only add agent file if it looks valid (not a fallback path with no match)
    if (agent.file && agent.file.includes(agent.id)) {
      files.push(agent.file);
    }
  } catch (_) {}

  return files;
}

// ─────────────────────────────────────────────────────────────
// STEP 7: Dispatch (updated with selective attachments)
// ─────────────────────────────────────────────────────────────
async function dispatchSprints(plan, contextPackagePath = null) {
  const byId = {};
  plan.sprints.forEach(s => byId[s.sprintId] = s);

  const briefPath = path.join(HARNESS_DIR, 'assignments', `master-brief-${Date.now()}.md`);
  await mkdir(path.dirname(briefPath), { recursive: true });
  await writeFile(briefPath, plan.masterBrief);
  console.log(`\n📋 Master brief: ${briefPath}`);

  const executed = new Set();
  let changed = true;
  while (executed.size < plan.sprints.length && changed) {
    changed = false;
    for (const sprint of plan.sprints) {
      if (executed.has(sprint.sprintId)) continue;
      const depsMet = sprint.dependsOn.every(d => executed.has(d));
      if (!depsMet) continue;

      await dispatchSingleSprint(sprint, plan.masterBrief, briefPath, plan.matrixFlags || [], contextPackagePath);
      executed.add(sprint.sprintId);
      changed = true;
    }
  }

  if (executed.size < plan.sprints.length) {
    const remaining = plan.sprints.filter(s => !executed.has(s.sprintId)).map(s => s.sprintId);
    console.log(`\n⚠️  Circular dependency or missing deps: ${remaining.join(', ')}`);
  }
}

async function dispatchSingleSprint(sprint, masterBrief, briefPath, globalMatrixFlags = [], contextPackagePath = null) {
  console.log(`\n🚀 Dispatching: ${sprint.sprintId} (${sprint.role})`);
  if (sprint.dependsOn.length > 0) console.log(`   Waiting for: ${sprint.dependsOn.join(', ')}`);

  const allFlags = [...globalMatrixFlags, ...(sprint.matrixFlags || [])];
  if (allFlags.length > 0) allFlags.forEach(f => console.log(`   ⚡ [${f.flag}] ${f.note}`));
  console.log(`   📦 Attachments: ${sprint.attachmentTier} tier (${sprint.attachmentTier === 'minimal' ? 'none' : sprint.attachmentTier === 'standard' ? 'TEMPLATE_BRIEF + contract' : 'full'})`);
  if (contextPackagePath) console.log(`   🗂  Context: ${contextPackagePath.replace(process.cwd() + '/', '')}`);

  const attachments = buildAttachments(sprint.agent, briefPath, path.join(HARNESS_DIR, 'contracts', `${sprint.sprintId}.md`), sprint.attachmentTier, contextPackagePath);

  // Write sprint contract file
  const contractPath = path.join(HARNESS_DIR, 'contracts', `${sprint.sprintId}.md`);
  await mkdir(path.dirname(contractPath), { recursive: true });
  await writeFile(contractPath, sprint.brief);

  const spawnConfig = {
    sprintId: sprint.sprintId,
    task: sprint.scope,
    role: sprint.role,
    agent: sprint.agent,
    attachments,
    contextPackagePath,
    attachmentTier: sprint.attachmentTier,
    masterBriefPath: briefPath,
    sprintContractPath: contractPath,
    dependsOn: sprint.dependsOn,
    matrixFlags: allFlags,
    sessionId: `session_${Date.now()}_${sprint.sprintId}`,
    dispatchTime: new Date().toISOString()
  };

  const spawnFile = path.join(WORKSPACE, `.harness-spawn-${sprint.sprintId}.json`);
  await writeFile(spawnFile, JSON.stringify(spawnConfig, null, 2));
  console.log(`   Config: ${spawnFile}`);
  console.log(`   ⚠️  OpenClaw sessions_spawn call goes here (integrate with sessions_spawn tool)`);
}

// ─────────────────────────────────────────────────────────────
// STEP 8: ACTIVE.md (updated with v4 fields)
// ─────────────────────────────────────────────────────────────
// WORKSPACE INDEX — per-project ACTIVE.md + workspace registry
// ─────────────────────────────────────────────────────────────

/**
 * Update workspace-level WORKSPACE.md index.
 * This file is the only artifact in the workspace root;
 * all project state lives inside each project's repo as ACTIVE.md.
 *
 * Format:
 * # WORKSPACE Index
 * ## Active Projects
 * | Project | ACTIVE.md | Status | Last Updated |
 * |---|---|---|---|
 * | WDG | /path/to/repo/ACTIVE.md | running | 2026-04-01T00:00:00Z |
 *
 * ## Current Focus
 * - wdg（可切换）
 */
async function ensureTASKSIndex(project, activeStatus = 'running') {
  const TASKS_PATH = path.join(WORKSPACE, 'TASKS.md');
  let catalog = [];

  try {
    const raw = await readFile(TASKS_PATH, 'utf8');
    const allSection = raw.includes('## All Projects') ? raw.split('## All Projects')[1] : '';
    const rows = allSection.split('\n').filter(line => /^\|\s*\d+\s*\|/.test(line.trim()));
    for (const row of rows) {
      const cols = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 4) {
        catalog.push({
          project: cols[1],
          repo: cols[2].replace(/`/g, ''),
          activeMd: 'ACTIVE.md',
          status: cols[3],
          notes: cols[4] || '',
        });
      }
    }
  } catch (_) {
    catalog = [];
  }

  const updated = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const existingIdx = catalog.findIndex(e =>
    e.project === project.displayName ||
    e.project.toLowerCase() === project.displayName.toLowerCase() ||
    e.repo === project.repoPath
  );

  if (existingIdx >= 0) {
    catalog[existingIdx] = {
      ...catalog[existingIdx],
      project: project.displayName,
      repo: project.repoPath,
      activeMd: 'ACTIVE.md',
      status: activeStatus,
    };
  } else {
    catalog.push({
      project: project.displayName,
      repo: project.repoPath,
      activeMd: 'ACTIVE.md',
      status: activeStatus,
      notes: project.displayName === 'agent-harness-trinity' ? 'Trinity skill suite master repo' : '',
    });
  }

  const activeRows = catalog
    .filter(e => ['running', 'goal_closed', 'blocked'].includes(e.status))
    .map(e => `| ${e.project} | \`${e.repo}\` | \`ACTIVE.md\` | ${e.status} | ${updated} |`)
    .join('\n');

  const allRows = catalog
    .map((e, i) => `| ${i + 1} | ${e.project} | \`${e.repo}\` | ${e.status} | ${e.notes || ''} |`)
    .join('\n');

  const content = `# TASKS.md — Project Registry & Active Index

> This is the **only** project index. It is both the catalog of all known projects and the active-working-set tracker.
> Managed by harness.js | **Do not edit content directly — use \`ACTIVE.md\` in each project repo**

---

## Active Projects

| Project | Repo | ACTIVE.md | Status | Last Updated |
|---------|------|-----------|--------|--------------|
${activeRows || '| | | | | |'}

---

## All Projects

> Add new projects here when they first receive a harness.

| # | Project | Repo | Status | Notes |
|---|---------|------|--------|-------|
${allRows || '| 1 | workspace | \`' + project.repoPath + '\` | ' + activeStatus + ' | |'}
`;

  await writeFile(TASKS_PATH, content);
  console.log(`   🗂  TASKS.md updated: ${TASKS_PATH}`);
}


// ─────────────────────────────────────────────────────────────
async function updateActive(project, taskDescription, plan) {
  // Write ACTIVE.md inside the project's repo (per-project isolation)
  const projectActiveFile = path.join(project.repoPath, 'ACTIVE.md');
  const { matrixFlags = [], continueGate, executionResult } = plan;
  const flagSummary = matrixFlags.length > 0
    ? `\n## Matrix Flags\n${matrixFlags.map(f => `- [${f.flag}] ${f.note}`).join('\n')}` : '';
  const continueGateSummary = continueGate ? `
## Continue Gate (v5 preview)
- **Final Oracle**: ${continueGate.finalOracle}
- **Local Oracle**: ${continueGate.localOracle}
- **Current Blocker**: ${continueGate.currentBlocker}
- **Round Outcome**: ${continueGate.roundOutcome}
- **Stop Allowed**: ${continueGate.stopAllowed}
- **Next Forced Bet**: ${continueGate.nextForcedBet}
- **Evidence Delta**: ${continueGate.evidenceDelta}
- **No-Evidence Rounds**: ${continueGate.noEvidenceRounds}
- **Last Evidence**: ${continueGate.lastEvidence || 'none yet'}
- **Evidence Artifact**: ${continueGate.evidenceArtifact || 'none'}
- **Result Status**: ${continueGate.resultStatus || executionResult?.status || 'pending'}
- **Pivot Trigger**: ${continueGate.pivotAfterNoEvidenceRounds} no-evidence rounds on same branch
` : '';

  const activeStatus = continueGate?.roundOutcome === 'goal_closed'
    ? 'goal_closed'
    : continueGate?.roundOutcome === 'blocked_approval' || continueGate?.roundOutcome === 'blocked_external' || continueGate?.roundOutcome === 'split_required'
      ? 'blocked'
      : 'running';
  const masterBriefPath = path.join(HARNESS_DIR, 'assignments', `master-brief-${Date.now()}.md`);

  const content = `# ACTIVE.md — Current WIP

> This file lives inside the project repo. TASKS.md is the only project index.

## Current Project
- **Name**: ${project.displayName}
- **Repo**: ${project.repoPath}
- **Task**: ${taskDescription}
- **Mode**: ${MODE_ARG}
- **Started**: ${new Date().toISOString()}
- **Status**: ${activeStatus}
- **Sprints**: ${plan.sprints.map(s => s.sprintId).join(', ')}

## Sprint Plan
${plan.sprints.map(s => {
  const sf = (s.matrixFlags || []).map(f => `[${f.flag}]`).join(' ');
  return `- **${s.sprintId}**: ${s.role} ${sf}| deps: ${s.dependsOn.join(', ') || 'none'} | attachments: ${s.attachmentTier}`;
}).join('\n')}${flagSummary}${continueGateSummary}

## Master Brief
${masterBriefPath}

## Version
harness.js v5-preview | per-project ACTIVE.md | TASKS.md index | ContextAssembler

---
*Last updated: ${new Date().toISOString()}*
`;

  await writeFile(projectActiveFile, content);
  console.log(`   ✅ ACTIVE.md written to project repo: ${projectActiveFile}`);

  // Update TASKS.md index
  await ensureTASKSIndex(project, activeStatus);
}

// ─────────────────────────────────────────────────────────────
// POST-TASK REPORT + CONTINUE-GATE ARTIFACTS
// ─────────────────────────────────────────────────────────────
async function writeContinueGateArtifact(masterConfig) {
  await mkdir(CONTINUE_GATE_ARTIFACTS_DIR, { recursive: true });
  const sprintId = masterConfig.plan.sprints[0]?.sprintId || 'report';
  const artifactPath = path.join(CONTINUE_GATE_ARTIFACTS_DIR, `${sprintId}.json`);
  const payload = {
    sprintId,
    taskDescription: masterConfig.taskDescription,
    lifecycle: masterConfig.lifecycle,
    continueGate: masterConfig.continueGate,
    executionResult: masterConfig.executionResult,
    // P2-8: scope selection reason
    scopeSelectionReason: masterConfig.plan?.scopeSelectionReason || null,
    // P2-9: feature and milestone queues
    featureQueue: masterConfig.plan?.featureQueue || null,
    milestoneQueue: masterConfig.plan?.milestoneQueue || null,
    updatedAt: new Date().toISOString()
  };
  await writeFile(artifactPath, JSON.stringify(payload, null, 2));
  console.log(`\n🧾 Continue-gate artifact: ${artifactPath}`);
}

async function writePostTaskReport(masterConfig) {
  await mkdir(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `sprint-${masterConfig.plan.sprints[0]?.sprintId || 'report'}-report.md`);

  const { project, plan, complexity, tokenTrack, continueGate, executionResult, lifecycle } = masterConfig;
  const sprint = plan.sprints[0];
  const statusHeading = lifecycle?.consumedResult
    ? 'result-consumed'
    : 'dispatch scaffold';

  const content = `# Sprint Post-Task Report

> **Sprint**: ${sprint?.sprintId || 'unknown'}
> **Generated by**: harness.js v5-preview (${statusHeading})
> **Mode**: ${MODE_ARG}
> **Complexity**: ${complexity}/10 → ${scoreToProfile(complexity)}
> **Attachment Tier**: ${plan.attachmentTier}

---

## §1 Sprint Metadata

| 字段 | 值 |
|------|-----|
| Project | ${project?.displayName} |
| Repo | ${project?.repoPath} |
| Task | ${masterConfig.taskDescription} |
| Agent | ${sprint?.role} |
| Dispatch Time | ${masterConfig.dispatchTime} |
| Estimated Tokens (harness) | ~${tokenTrack?.estimatedTokens || 0} |

---

## §1.5 Continue Gate (v5 preview)

| Field | Value |
|------|-----|
| Final Oracle | ${continueGate?.finalOracle || '⬜ fill'} |
| Local Oracle | ${continueGate?.localOracle || '⬜ fill'} |
| Current Blocker | ${continueGate?.currentBlocker || '⬜ fill'} |
| Round Outcome | ${continueGate?.roundOutcome || 'retry_with_new_bet / split_required'} |
| Stop Allowed | ${continueGate?.stopAllowed || 'no'} |
| Next Forced Bet | ${continueGate?.nextForcedBet || '⬜ fill'} |
| Evidence Delta | ${continueGate?.evidenceDelta || 'pending-first-round'} |
| No-Evidence Rounds | ${continueGate?.noEvidenceRounds || 0} |
| Last Evidence | ${continueGate?.lastEvidence || '⬜ fill'} |
| Evidence Artifact | ${continueGate?.evidenceArtifact || '⬜ fill'} |
| Pivot Trigger | ${continueGate?.pivotAfterNoEvidenceRounds || 2} no-evidence rounds |
| Result Consumed At | ${continueGate?.resultConsumedAt || executionResult?.consumedAt || '⬜ pending'} |
| Selected Feature | ${continueGate?.selectedFeatureId ? `${continueGate.selectedFeatureId} — ${continueGate.selectedFeatureTitle}` : 'n/a'} |

${continueGate?.acceptanceCriteria?.length > 0 ? `### Feature Acceptance Criteria\n${formatAcceptanceCriteriaMarkdown(continueGate.acceptanceCriteria)}\n\n` : ''}---

## §2 Token Tracking

| Item | Estimated |
|------|-----------|
| Repo scan | ~${(tokenTrack?.estimatedTokens || 0) < 200 ? tokenTrack?.estimatedTokens : 0} |
| LLM analysis calls | ${tokenTrack?.llmCalls || 0} × ~2500 = ~${((tokenTrack?.llmCalls || 0) * 2500)} |
| Subagent tokens (est.) | ~${(tokenTrack?.subagentEstimate || 1) * 3000} |
| **Total estimated** | **~${((tokenTrack?.llmCalls || 0) * 2500) + ((tokenTrack?.subagentEstimate || 1) * 3000)} tokens** |

> ${lifecycle?.consumedResult ? 'Result fields were backfilled through --consume-result.' : 'Main agent may still add actual token usage after sprint completes (from session_status).'}

---

## §3 Execution Result

| Field | Value |
|-------|-------|
| Status | ${executionResult?.status || continueGate?.resultStatus || '🔴 not started / ⚠️ partial / ✅ done / 🔴 blocked'} |
| Actual Duration | ${executionResult?.actualDurationMin ?? '__'} min |
| Retry Count | ${executionResult?.retryCount ?? '__'} |
| Failure Type | ${executionResult?.failureType || continueGate?.failureType || 'none / L0 / L1 / L2'} |
| Round Outcome | ${continueGate?.roundOutcome || 'goal_closed / retry_with_new_bet / pivot_required / blocked_external / blocked_approval / split_required'} |

### What was done
${executionResult?.whatWasDone || '⬜ List completed items'}

### What was NOT done
${executionResult?.whatWasNotDone || '⬜ List incomplete items'}

---

## §4 Verification

| Check | Result |
|-------|--------|
| Local Oracle | ${continueGate?.localOracle || '⬜'} |
| Final Oracle | ${continueGate?.roundOutcome === 'goal_closed' ? '✅ passed' : '⬜ verify / still pending'} |
| Feature acceptance criteria wired | ${continueGate?.acceptanceCriteria?.length > 0 ? '✅' : '⬜ / n.a.'} |
| Guard / evidence recorded | ${continueGate?.evidenceArtifact || executionResult?.verificationEvidence ? '✅' : '⬜'} |

### Verification evidence
${executionResult?.verificationEvidence || continueGate?.lastEvidence || '⬜ Paste command outputs / artifact paths'}

---

## §5 Assessment

| Dimension | Rating (1-5) | Notes |
|-----------|-------------|-------|
| Scope accuracy | ⬜ | Did output match contract? |
| Token efficiency | ⬜ | Was attachment tier appropriate? |
| Agent quality | ⬜ | Right agent for the task? |
| Mode selection | ⬜ | Was --mode choice appropriate? |

### Design hypothesis check
⬜ Did the mechanism work as designed?
- Complexity scoring card → accurate? (actual complexity vs predicted)
- Attachment tier → sufficient / excessive / insufficient?
- Agent decision tree → right agent selected?
- Mode selection → token savings achieved?

---

## §6 Lessons Learned

### What went well
⬜

### What to improve
⬜

### Mechanism feedback
⬜

---

*Report version: v5-preview | continue-gate artifact: harness/artifacts/continue-gate/${sprint?.sprintId || 'report'}.json*
`;
  await writeFile(reportPath, content);
  console.log(`\n📊 Report written: ${reportPath}`);
}

// ─────────────────────────────────────────────────────────────
// LEARNINGS — Ralph principle: every round writes back a learning
// ─────────────────────────────────────────────────────────────
async function appendRoundLearning(project, taskDescription, plan) {
  const { continueGate, executionResult, sprints } = plan;
  if (!continueGate) return;

  const agentsPath = path.join(project.repoPath, 'AGENTS.md');
  let raw = '';
  try {
    raw = await readFile(agentsPath, 'utf8');
  } catch (_) {
    // No AGENTS.md in this repo — skip silently
    return;
  }

  const entry = buildLearningEntry(taskDescription, plan);
  const MARKER_START = '<!-- LEARNINGS_BLOCK -->';
  const MARKER_END = '<!-- LEARNINGS_END -->';

  let next;
  if (raw.includes(MARKER_START) && raw.includes(MARKER_END)) {
    // Append inside the block
    next = raw
      .replace(MARKER_END, `\n${entry}\n${MARKER_END}`);
  } else {
    // No block yet — create one at the end of the file
    const newBlock = `\n${MARKER_START}\n## Learnings\n_Last round entry auto-appended by harness.js. Edit inside the block only._\n\n${entry}\n${MARKER_END}\n`;
    next = raw.trimEnd() + newBlock;
  }

  await writeFile(agentsPath, next);
  console.log(`   📝 Learning appended to: ${agentsPath}`);
}

function buildLearningEntry(taskDescription, plan) {
  const { continueGate, executionResult, sprints } = plan;
  const date = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const outcome = continueGate?.roundOutcome || 'unknown';
  const sprintList = sprints.map(s => s.sprintId).join(', ') || 'none';
  const blocker = continueGate?.currentBlocker || '';
  const evidence = continueGate?.lastEvidence || executionResult?.verificationEvidence || '';
  const insight = deriveInsight(taskDescription, plan);

  return `### ${date} — ${outcome}

- **Task**: ${taskDescription}
- **Sprints**: ${sprintList}
- **Blocker**: ${blocker || '_none_'}
- **Insight**: ${insight}
- **Evidence**: ${evidence || '_pending_'}
`;
}

function deriveInsight(taskDescription, plan) {
  const { continueGate, executionResult } = plan;
  const outcome = continueGate?.roundOutcome;
  if (outcome === 'goal_closed') return 'Goal reached — record closure and stop.';
  if (outcome === 'split_required') return 'Story too large for one round; split before retry.';
  if (outcome === 'pivot_required') return 'Same branch produced no new evidence for 2 rounds; change approach.';
  if (outcome === 'blocked_approval') return 'Hit approval boundary; await Boss authorization.';
  if (outcome === 'blocked_external') return 'External dependency blocked execution; record and wait.';
  if (executionResult?.whatWasDone) return `Completed: ${executionResult.whatWasDone.split('\n')[0]}`;
  return 'One bounded iteration executed; verify and continue.';
}

// ─────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────
function printReport(project, taskDescription, llmResult, plan, complexity, tokenTrack) {
  const { matrixFlags = [], continueGate, executionResult } = plan;

  console.log('\n' + '='.repeat(70));
  console.log('📊 HARNESS TASK REPORT v5-preview — Continue Gate + Token-Aware');
  console.log('='.repeat(70));
  console.log(`Project:     ${project.displayName}`);
  console.log(`Task:        ${taskDescription}`);
  console.log(`Mode:        ${MODE_ARG} (--mode ${MODE_ARG})`);
  console.log(`Complexity:  ${complexity}/10 → ${scoreToProfile(complexity)}`);
  console.log(`LLM Calls:   ${tokenTrack.llmCalls}`);
  console.log(`Est. Tokens: ~${tokenTrack.estimatedTokens + (tokenTrack.llmCalls * 2500) + (tokenTrack.subagentEstimate * 3000)} (harness.js only)`);

  if (continueGate) {
    console.log(`Final Oracle: ${continueGate.finalOracle}`);
    console.log(`Local Oracle: ${continueGate.localOracle}`);
    console.log(`Round Outcome: ${continueGate.roundOutcome} | Stop Allowed: ${continueGate.stopAllowed}`);
    console.log(`Next Forced Bet: ${continueGate.nextForcedBet}`);
    console.log(`Evidence Delta: ${continueGate.evidenceDelta} | No-Evidence Rounds: ${continueGate.noEvidenceRounds}`);
    if (continueGate.lastEvidence) console.log(`Last Evidence: ${continueGate.lastEvidence}`);
    if (continueGate.evidenceArtifact) console.log(`Evidence Artifact: ${continueGate.evidenceArtifact}`);
    if (continueGate.failureType) console.log(`Failure Type: ${continueGate.failureType}`);
    if (continueGate.resultStatus) console.log(`Result Status: ${continueGate.resultStatus}`);
    if (continueGate.selectedFeatureId) console.log(`Selected Feature: ${continueGate.selectedFeatureId} | ${continueGate.selectedFeatureTitle}`);
    if (continueGate.acceptanceCriteria?.length > 0) console.log(`Feature Acceptance Criteria: ${continueGate.acceptanceCriteria.length}`);
    console.log(`Pivot Trigger: ${continueGate.pivotAfterNoEvidenceRounds} no-evidence rounds on same branch`);
  }

  if (executionResult?.consumedAt) {
    console.log(`Result Consumed: ${executionResult.consumedAt}`);
  }

  if (llmResult?.taskProfile) {
    console.log(`LLM Profile: ${llmResult.taskProfile.taskType} | risk: ${llmResult.taskProfile.riskLevel} | scope: ${llmResult.taskProfile.scopeGuess}`);
  }

  if (matrixFlags.length > 0) {
    console.log(`\n⚡ Matrix Flags:`);
    matrixFlags.forEach(f => {
      const icon = f.flag.includes('WARN') ? '⚠️ ' : '→';
      console.log(`   ${icon} [${f.flag}] ${f.note}`);
    });
  }

  console.log(`\nSprints:`);
  plan.sprints.forEach(s => {
    const sf = (s.matrixFlags || []).map(f => `[${f.flag}]`).join(' ');
    console.log(`   ${s.sprintId}: ${s.role} ${sf}`);
    console.log(`     Attachments: ${s.attachmentTier} tier → ${s.attachmentTier === 'minimal' ? '(none)' : s.attachmentTier === 'standard' ? 'TEMPLATE_BRIEF + contract' : 'full'}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log(`\n✅ harness.js v5-preview ${CONSUME_RESULT ? 'result consumption' : 'dispatch'} complete`);
  console.log('   ACTIVE.md written to project repo (per-project isolation)');
  console.log('   TASKS.md index updated');
  console.log('   Continue gate synced into report + harness/artifacts/continue-gate');
  if (!CONSUME_RESULT) {
    console.log('   Next: confirm with Boss → sessions_spawn dispatch');
  }
  console.log('   Report path: harness/reports/sprint-*-report.md');
  console.log('');
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function extractArg(name, args) {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

function stripFlagValues(args, flagsWithValues) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (flagsWithValues.has(arg)) {
      i += 1;
      continue;
    }
    if (arg.startsWith('--')) continue;
    out.push(arg);
  }
  return out;
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
