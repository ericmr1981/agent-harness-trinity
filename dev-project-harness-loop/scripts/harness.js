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

const WORKSPACE      = process.env.OPENCLAW_WORKSPACE || process.cwd();
const HARNESS_DIR    = path.join(WORKSPACE, 'harness');
const REPORTS_DIR    = path.join(HARNESS_DIR, 'reports');
const WORKSPACE_ROOT = WORKSPACE;                                          // workspace root (parent of all project repos)
const WORKSPACE_INDEX = path.join(WORKSPACE_ROOT, 'WORKSPACE.md');         // project index (not content)
const TASKS_FILE     = path.join(WORKSPACE, 'TASKS.md');                 // legacy tasks index
const GITHUB_ROOT    = process.env.GITHUB_ROOT || '/Users/ericmr/Documents/GitHub';

// ─────────────────────────────────────────────────────────────
// ARGUMENT PARSING
// ─────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
const MODE_ARG    = extractArg('--mode', rawArgs) || 'llm';           // default: full LLM
const COMPLEXITY  = parseInt(extractArg('--complexity', rawArgs) || '0'); // 0 = auto
const DRY_RUN     = rawArgs.includes('--dry-run');
const TASK_ARGS   = rawArgs.filter(a => !a.startsWith('--'));
const taskDescription = TASK_ARGS.join(' ') || '';

if (!taskDescription) {
  console.error('❌ Usage: /harness [flags] <task description>\n   Flags: --mode <minimal|keyword|llm|llm-full> --complexity <0-10> --no-preflight --dry-run');
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
  console.log(`\n🔍 Analyzing task: ${taskDescription}`);
  console.log(`   Mode: ${MODE_ARG} | Complexity override: ${COMPLEXITY || 'auto'}\n`);

  // Token tracking init
  const tokenTrack = { mode: MODE_ARG, llmCalls: 0, estimatedTokens: 0, subagentEstimate: 0 };

  // Step 1: Discover project
  const project = await discoverProject(taskDescription);
  console.log(`📁 Project: ${project.displayName} | Repo: ${project.repoPath}`);

  // Step 1.5: CONTEXT ASSEMBLER (skipped in minimal mode)
  let contextPackagePath = null;
  if (MODE_ARG !== 'minimal') {
    try {
      contextPackagePath = await runContextAssembler(project.repoPath, taskDescription);
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
  if (MODE_ARG !== 'minimal') {
    scan = await scanRepo(project.repoPath);
    tokenTrack.estimatedTokens += scan.srcFiles.length * 2; // trivial
  }

  // Step 3: Complexity scoring (override or compute)
  const complexity = COMPLEXITY > 0 ? COMPLEXITY : (scan ? computeComplexity(taskDescription, scan) : 3);
  console.log(`\n📊 Complexity Score: ${complexity}/10 → Profile: ${scoreToProfile(complexity)}`);

  // Step 4: LLM analysis (skip in minimal/keyword modes)
  let llmResult = null;
  if (MODE_ARG === 'llm' || MODE_ARG === 'llm-full') {
    llmResult = await analyzeTaskWithLLM(taskDescription, project, scan);
    tokenTrack.llmCalls += 1;
    tokenTrack.estimatedTokens += 2500;
  } else {
    // keyword fallback
    llmResult = keywordAnalysis(taskDescription, scan);
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
      llmResult = await analyzeTaskWithLLM(`${taskDescription} ${answer}`, project, scan);
      tokenTrack.llmCalls += 1;
    }
  }

  // Step 6: Sprint plan
  const plan = await generateSprintPlan(taskDescription, project, llmResult, scan, complexity, tokenTrack, contextPackagePath);

  // Step 7: Dispatch
  if (!DRY_RUN) {
    await dispatchSprints(plan, contextPackagePath);
    await updateActive(project, taskDescription, plan);
  }

  // Step 8: Write master + report
  const masterConfig = {
    project, taskDescription, llmResult, plan, complexity,
    tokenTrack,
    continueGate: plan.continueGate,
    dispatchTime: new Date().toISOString(),
    version: 'harness.js v5-preview'
  };
  await writeFile(path.join(WORKSPACE, '.harness-master.json'), JSON.stringify(masterConfig, null, 2));

  // Step 9: Generate post-task report (scaffold — actual run data filled by main agent after execution)
  await writePostTaskScaffold(masterConfig);

  printReport(project, taskDescription, llmResult, plan, complexity, tokenTrack);
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

async function findRepoInGithubRoot(name) {
  try {
    const dirs = await readdir(GITHUB_ROOT);
    const normalized = name.toLowerCase().replace(/[_\s]+/g, '-');
    for (const dir of dirs) {
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
    const dirs = await readdir(GITHUB_ROOT);
    for (const dir of dirs) {
      const normalized = dir.toLowerCase().replace(/[_\s]+/g, '-');
      if (normalized.includes(lower.replace(/[^\w]/g, ''))) {
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
    'CLAUDE.md',
    'AGENTS.md',
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
    console.log('     bash project-harness-guards/scripts/scaffold_harness.sh "${repoPath}"');
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
      `find "${repoPath}" -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.java" -o -name "*.cs" \\) ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" ! -path "*/__pycache__/*" 2>/dev/null`,
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

  const topFiles = [...srcFiles].filter(f => f.lines > 0).sort((a, b) => b.lines - a.lines).slice(0, 20);

  let buildCmd = 'unknown', testCmd = 'none';
  try {
    if (codebaseType === 'Node.js/TypeScript') {
      const pj = JSON.parse(execSync(`cat "${repoPath}/package.json"`, { encoding: 'utf8' }));
      buildCmd = pj.scripts?.build || 'npm run build';
      testCmd  = pj.scripts?.test  || 'npm test';
    }
  } catch (_) {}

  let guardCmd = 'unknown';
  try {
    if (execSync(`test -f "${repoPath}/scripts/run_change_guard.sh" && echo yes`, { encoding: 'utf8' }).includes('yes')) {
      guardCmd = 'bash scripts/run_change_guard.sh';
    }
  } catch (_) {}

  return { repoPath, codebaseType, framework, srcFiles, topFiles, buildCmd, testCmd, guardCmd };
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
- isMultiAgent=true when task spans different skill domains
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
async function generateSprintPlan(taskDescription, project, llmResult, scan, complexity, tokenTrack, contextPackagePath) {
  const sprints = [];
  const baseDir = path.join(HARNESS_DIR, 'contracts');
  await mkdir(baseDir, { recursive: true });

  const { taskType, riskLevel, scopeGuess } = llmResult?.taskProfile || { taskType: 'single', riskLevel: 'medium', scopeGuess: 'multi-file' };
  const matrixFlags = buildMatrixFlags(complexity, riskLevel, scopeGuess, llmResult);

  // Agent selection: decision tree (llm mode) or keyword fallback
  const agent = MODE_ARG === 'minimal'
    ? { id: 'engineering-senior-developer', confidence: 50, category: 'engineering', file: 'skills/agency-agents-lib/agents/engineering/engineering-senior-developer.md' }
    : agencyDecisionTree(taskDescription, llmResult, complexity);

  console.log(`\n🤖 Selected Agent: ${agent.id} (confidence: ${agent.confidence}%)`);
  tokenTrack.subagentEstimate = complexity >= 7 ? 4 : complexity >= 4 ? 2 : 1;

  // Determine attachment tier
  const tier = scoreToAttachmentTier(complexity);
  const continueGate = deriveContinueGate(taskDescription, project, llmResult, scan, complexity);
  console.log(`📦 Attachment Tier: ${tier} (${tier === 'minimal' ? '无附件' : tier === 'standard' ? 'TEMPLATE_BRIEF only' : 'full 6-7 files'})`);

  if (llmResult?.isMultiAgent && llmResult.agentPlan?.length > 0) {
    for (const spec of llmResult.agentPlan) {
      sprints.push({
        sprintId: spec.sprintId,
        role: spec.role,
        scope: spec.scope,
        dependsOn: spec.dependsOn || [],
        brief: buildSprintBrief(taskDescription, project, llmResult, scan, spec, sprints, matrixFlags, agent, continueGate),
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
      brief: buildSprintBrief(taskDescription, project, llmResult, scan, spec, [], matrixFlags, agent, continueGate),
      agent,
      attachmentTier: tier
    });
  }

  const masterBrief = buildMasterBrief(project, scan, llmResult, matrixFlags, agent, complexity, continueGate);
  return { sprints, masterBrief, matrixFlags, attachmentTier: tier, continueGate };
}

function buildMatrixFlags(complexity, riskLevel, scopeGuess, llmResult) {
  const flags = [];
  if (complexity >= 7)  flags.push({ flag: 'COMPLEXITY_HIGH', note: `complexity=${complexity} — PGE-sprint enforced` });
  if (complexity >= 4)  flags.push({ flag: 'COMPLEXITY_MED', note: `complexity=${complexity} — consider multi-sprint` });
  if (riskLevel === 'high') flags.push({ flag: 'RISK_HIGH', note: 'L1 acceptance enforced — no L0 shortcuts' });
  if (scopeGuess === 'cross-layer' || scopeGuess === 'full-rewrite') flags.push({ flag: 'SCOPE_CROSS', note: `scope=${scopeGuess} — affects multiple layers` });
  if (llmResult?.isMultiAgent) flags.push({ flag: 'MULTI_AGENT', note: 'multi-agent sprint plan generated' });
  return flags;
}

function buildMasterBrief(project, scan, llmResult, matrixFlags, agent, complexity, continueGate) {
  const flagSection = matrixFlags.length > 0
    ? `\n## Matrix Flags\n${matrixFlags.map(f => `- **[${f.flag}]** ${f.note}`).join('\n')}\n`
    : '';

  const continueGateSection = continueGate ? `
## Continue Gate (v5 preview)
- **Final Oracle**: ${continueGate.finalOracle}
- **Current Blocker**: ${continueGate.currentBlocker}
- **Round Outcome**: ${continueGate.roundOutcome}
- **Stop Allowed**: ${continueGate.stopAllowed}
- **Next Forced Bet**: ${continueGate.nextForcedBet}
- **Pivot Trigger**: ${continueGate.pivotAfterNoEvidenceRounds} no-evidence rounds on same branch
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
${flagSection}${continueGateSection}

## 架构要点
${llmResult?.enhancedBrief || '无 LLM 分析（minimal/keyword 模式）'}

${scan ? `## 代码库
- **类型**: ${scan.codebaseType} | **框架**: ${scan.framework}
- **构建**: \`${scan.buildCmd}\` | **测试**: \`${scan.testCmd}\` | **Guard**: \`${scan.guardCmd}\`

## 主要文件
${scan.topFiles.slice(0, 10).map(f => `- \`${f.rel}\` (${f.lines}L)`).join('\n')}
` : ''}`;
  return brief;
}

function buildSprintBrief(taskDescription, project, llmResult, scan, spec, priorSprints, matrixFlags, agent, continueGate = null) {
  const acceptanceSection = scan ? `## 验收
\`\`\`bash
cd "${project.repoPath}" && ${scan.buildCmd} && ${scan.guardCmd}
\`\`\`` : '## 验收\n请参考项目实际构建命令';

  const continueGateSection = continueGate ? `
## Continue Gate (v5 preview)
- **Final Oracle**: ${continueGate.finalOracle}
- **Current Blocker**: ${continueGate.currentBlocker}
- **Stop Allowed**: ${continueGate.stopAllowed}
- **Next Forced Bet**: ${continueGate.nextForcedBet}
- **Pivot Trigger**: ${continueGate.pivotAfterNoEvidenceRounds} no-evidence rounds on same branch
` : '';

  return `# Sprint Contract — ${spec.sprintId}

## 任务
${spec.scope}

## 项目
${project.displayName} | ${project.repoPath}

## Agent
${spec.role}
${matrixFlags.length > 0 ? `\n## Matrix Flags\n${matrixFlags.map(f => `- **[${f.flag}]** ${f.note}`).join('\n')}` : ''}${continueGateSection}

## 依赖
${spec.dependsOn.length === 0 ? '_无_' : spec.dependsOn.map(d => `- ${d}`).join('\n')}

${acceptanceSection}

## 注意事项
${llmResult?.enhancedBrief || ''}

---
*Generated: ${new Date().toISOString()}*`;
}

function deriveContinueGate(taskDescription, project, llmResult, scan, complexity) {
  const finalOracle = scan
    ? `Live acceptance for \"${taskDescription}\" plus local oracle: ${scan.buildCmd} && ${scan.guardCmd}`
    : `Human-visible final acceptance for \"${taskDescription}\"`;

  const nextForcedBet = scan
    ? `Execute one bounded bet, then run ${scan.buildCmd} and ${scan.guardCmd}; if final oracle still fails, record evidence delta and launch the next repair step.`
    : 'Execute one bounded bet, verify against the real acceptance path, and if the final oracle still fails, record evidence delta and continue.';

  return {
    finalOracle,
    currentBlocker: 'Not yet verified against final oracle. Replace with concrete blocker after the first failed live check.',
    roundOutcome: 'retry_with_new_bet',
    stopAllowed: 'no',
    nextForcedBet,
    evidenceDelta: 'pending-first-round',
    pivotAfterNoEvidenceRounds: 2,
    localOracle: scan ? `${scan.buildCmd} && ${scan.guardCmd}` : 'project-local verification command not yet discovered'
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
async function ensureWorkspaceIndex(project, taskDescription, plan, activeStatus = 'running') {
  let indexContent = '';
  let entries = [];

  try {
    const raw = await readFile(WORKSPACE_INDEX, 'utf8');
    // Extract existing entries by parsing the table rows
    const tableMatch = raw.match(/\| Project(.+?)\n[^|]*$/s);
    if (tableMatch) {
      const rows = raw.split('\n').filter(l => l.trim().startsWith('|') && !l.includes('---') && !l.includes('Project |'));
      for (const row of rows) {
        const cols = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cols.length >= 3) entries.push({ project: cols[0], activePath: cols[1], status: cols[2], updated: cols[3] || '' });
      }
    }
  } catch (_) {
    // No index yet — start fresh
    indexContent = `# WORKSPACE Index

> Managed by harness.js v4 | **Do not edit content directly — use \`ACTIVE.md\` in each project repo**

## Active Projects
| Project | ACTIVE.md Path | Status | Last Updated |
|---------|----------------|--------|--------------|
`;
  }

  // Update or add entry for this project
  const activePath = path.join(project.repoPath, 'ACTIVE.md');
  const updated = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const existingIdx = entries.findIndex(e => e.project === project.displayName || e.project.toLowerCase() === project.displayName.toLowerCase());
  if (existingIdx >= 0) {
    entries[existingIdx] = { project: project.displayName, activePath, status: activeStatus, updated };
  } else {
    entries.push({ project: project.displayName, activePath, status: activeStatus, updated });
  }

  // Rebuild index
  const rows = entries.map(e => `| ${e.project} | \`${e.activePath}\` | ${e.status} | ${e.updated} |`).join('\n');
  const header = `# WORKSPACE Index

> Managed by harness.js v4 | **Do not edit content directly — use \`ACTIVE.md\` in each project repo**

## Active Projects
| Project | ACTIVE.md Path | Status | Last Updated |
|---------|----------------|--------|--------------|
`;

  indexContent = header + rows + '\n';
  await writeFile(WORKSPACE_INDEX, indexContent);
  console.log(`   🗂  Workspace index updated: ${WORKSPACE_INDEX}`);
}

// ─────────────────────────────────────────────────────────────
async function updateActive(project, taskDescription, plan) {
  // Write ACTIVE.md inside the project's repo (per-project isolation)
  const projectActiveFile = path.join(project.repoPath, 'ACTIVE.md');
  const { matrixFlags = [], continueGate } = plan;
  const flagSummary = matrixFlags.length > 0
    ? `\n## Matrix Flags\n${matrixFlags.map(f => `- [${f.flag}] ${f.note}`).join('\n')}` : '';
  const continueGateSummary = continueGate ? `
## Continue Gate (v5 preview)
- **Final Oracle**: ${continueGate.finalOracle}
- **Current Blocker**: ${continueGate.currentBlocker}
- **Round Outcome**: ${continueGate.roundOutcome}
- **Stop Allowed**: ${continueGate.stopAllowed}
- **Next Forced Bet**: ${continueGate.nextForcedBet}
- **Evidence Delta**: ${continueGate.evidenceDelta}
- **Pivot Trigger**: ${continueGate.pivotAfterNoEvidenceRounds} no-evidence rounds on same branch
` : '';

  const content = `# ACTIVE.md — Current WIP

> This file lives inside the project repo. The workspace root WORKSPACE.md is only an index.

## Current Project
- **Name**: ${project.displayName}
- **Repo**: ${project.repoPath}
- **Task**: ${taskDescription}
- **Mode**: ${MODE_ARG}
- **Started**: ${new Date().toISOString()}
- **Status**: running
- **Sprints**: ${plan.sprints.map(s => s.sprintId).join(', ')}

## Sprint Plan
${plan.sprints.map(s => {
  const sf = (s.matrixFlags || []).map(f => `[${f.flag}]`).join(' ');
  return `- **${s.sprintId}**: ${s.role} ${sf}| deps: ${s.dependsOn.join(', ') || 'none'} | attachments: ${s.attachmentTier}`;
}).join('\n')}${flagSummary}${continueGateSummary}

## Master Brief
${path.join(HARNESS_DIR, 'assignments')}/master-brief-${Date.now()}.md

## Version
harness.js v5-preview | per-project ACTIVE.md | workspace index | ContextAssembler

---
*Last updated: ${new Date().toISOString()}*
`;

  await writeFile(projectActiveFile, content);
  console.log(`   ✅ ACTIVE.md written to project repo: ${projectActiveFile}`);

  // Update workspace root index
  await ensureWorkspaceIndex(project, taskDescription, plan);
}

// ─────────────────────────────────────────────────────────────
// POST-TASK REPORT SCAFFOLD (NEW in v4)
// ─────────────────────────────────────────────────────────────
async function writePostTaskScaffold(masterConfig) {
  await mkdir(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `sprint-${masterConfig.plan.sprints[0]?.sprintId || 'report'}-report.md`);

  const { project, plan, complexity, tokenTrack, continueGate } = masterConfig;
  const sprint = plan.sprints[0];

  const content = `# Sprint Post-Task Report

> **Sprint**: ${sprint?.sprintId || 'unknown'}
> **Generated by**: harness.js v5-preview (scaffold — fill after execution)
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
| Current Blocker | ${continueGate?.currentBlocker || '⬜ fill'} |
| Round Outcome | ${continueGate?.roundOutcome || 'retry_with_new_bet'} |
| Stop Allowed | ${continueGate?.stopAllowed || 'no'} |
| Next Forced Bet | ${continueGate?.nextForcedBet || '⬜ fill'} |
| Evidence Delta | ${continueGate?.evidenceDelta || 'pending-first-round'} |
| Pivot Trigger | ${continueGate?.pivotAfterNoEvidenceRounds || 2} no-evidence rounds |

---

## §2 Token Tracking

| Item | Estimated |
|------|-----------|
| Repo scan | ~${(tokenTrack?.estimatedTokens || 0) < 200 ? tokenTrack?.estimatedTokens : 0} |
| LLM analysis calls | ${tokenTrack?.llmCalls || 0} × ~2500 = ~${((tokenTrack?.llmCalls || 0) * 2500)} |
| Subagent tokens (est.) | ~${(tokenTrack?.subagentEstimate || 1) * 3000} |
| **Total estimated** | **~${((tokenTrack?.llmCalls || 0) * 2500) + ((tokenTrack?.subagentEstimate || 1) * 3000)} tokens** |

> ⬜ **Main agent: fill actual token usage after sprint completes** (from session_status)

---

## §3 Execution Result

> ⬜ **Fill after subagent completes**

| Field | Value |
|-------|-------|
| Status | 🔴 not started / ⚠️ partial / ✅ done / 🔴 blocked |
| Actual Duration | __ min |
| Retry Count | __ |
| Failure Type | none / L0 / L1 / L2 |
| Round Outcome | goal_closed / retry_with_new_bet / pivot_required / blocked_external / blocked_approval |

### What was done
⬜ List completed items

### What was NOT done
⬜ List incomplete items

---

## §4 Verification

| Check | Result |
|-------|--------|
| L0 (build) | ⬜ |
| L1 (test) | ⬜ |
| L2 (e2e/manual) | ⬜ |
| Guard pass | ⬜ |

### Verification evidence
⬜ Paste command outputs / artifact paths

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

*Report version: scaffold v1 | Fill fields marked ⬜ after sprint execution*
`;
  await writeFile(reportPath, content);
  console.log(`\n📊 Report scaffold: ${reportPath}`);
}

// ─────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────
function printReport(project, taskDescription, llmResult, plan, complexity, tokenTrack) {
  const { matrixFlags = [], continueGate } = plan;

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
    console.log(`Round Outcome: ${continueGate.roundOutcome} | Stop Allowed: ${continueGate.stopAllowed}`);
    console.log(`Next Forced Bet: ${continueGate.nextForcedBet}`);
    console.log(`Pivot Trigger: ${continueGate.pivotAfterNoEvidenceRounds} no-evidence rounds on same branch`);
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
  console.log('\n✅ harness.js v5-preview complete');
  console.log('   ACTIVE.md written to project repo (per-project isolation)');
  console.log('   Workspace index updated: WORKSPACE.md');
  console.log('   Continue gate scaffolded: finalOracle / roundOutcome / nextForcedBet');
  console.log('   Next: confirm with Boss → sessions_spawn dispatch');
  console.log('   After sprint: fill → harness/reports/sprint-*-report.md');
  console.log('');
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function extractArg(name, args) {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
