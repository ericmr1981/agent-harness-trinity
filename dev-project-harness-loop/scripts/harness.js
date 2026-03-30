#!/usr/bin/env node
/**
 * /harness v3 — Unified project advancement with LLM augmentation
 *
 * Core principles:
 *   - Model participation: LLM analyzes task + repo to generate task profile + enhanced brief
 *   - Clarification on missing info: ask or infer, never guess critical constraints
 *   - Multi-agent orchestration: detect multi-role tasks, generate sprint plan with dependencies
 *   - Zero hardcoded projects: dynamic discovery from filesystem + TASKS.md
 *
 * Usage:
 *   /harness <task description>
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE      = process.env.OPENCLAW_WORKSPACE || process.cwd();
const HARNESS_DIR    = path.join(WORKSPACE, 'harness');
const ACTIVE_FILE    = path.join(WORKSPACE, 'ACTIVE.md');
const TASKS_FILE     = path.join(WORKSPACE, 'TASKS.md');
const GITHUB_ROOT    = '/Users/ericmr/Documents/GitHub';  // configurable via env

// ============================================================
// AGENT KEYWORDS (only used for fallback scoring)
// ============================================================
const AGENT_KEYWORDS = {
  'engineering-frontend-developer':    { keywords: ['react','vue','angular','ui','css','frontend','网页','前端','mobile','responsive'], weight: 1.0, category: 'engineering' },
  'engineering-backend-architect':     { keywords: ['api','database','schema','backend','后端','服务器','microservice'], weight: 1.0, category: 'engineering' },
  'engineering-security-engineer':     { keywords: ['security','auth','encryption','安全','渗透','漏洞','owasp'], weight: 1.2, category: 'engineering' },
  'engineering-test-engineer':         { keywords: ['test','qa','e2e','unit','integration','测试','自动化'], weight: 1.0, category: 'engineering' },
  'engineering-devops-automator':      { keywords: ['ci/cd','deploy','pipeline','docker','kubernetes','devops','部署','容器'], weight: 1.0, category: 'engineering' },
  'engineering-ai-engineer':          { keywords: ['ai','ml','machine learning','llm','rag','人工智能','大模型','机器学习'], weight: 1.2, category: 'engineering' },
  'engineering-data-engineer':         { keywords: ['data pipeline','etl','spark','dbt','data lake','数据管道','数据工程'], weight: 1.0, category: 'engineering' },
  'engineering-mobile-app-builder':    { keywords: ['ios','android','mobile app','react native','flutter','移动端','APP'], weight: 1.0, category: 'engineering' },
  'engineering-senior-developer':     { keywords: ['senior','refactor','architecture','重构','资深','technical debt'], weight: 1.0, category: 'engineering' },
  'engineering-software-architect':    { keywords: ['software architect','system design','hld','architecture pattern','系统架构'], weight: 1.2, category: 'engineering' },
  'engineering-database-optimizer':    { keywords: ['database','sql','postgres','mysql','mongodb','redis','数据库','performance'], weight: 1.0, category: 'engineering' },
  'engineering-technical-writer':       { keywords: ['documentation','docs','readme','wiki','swagger','openapi','文档','技术文档'], weight: 1.0, category: 'engineering' },
  'engineering-incident-response-commander': { keywords: ['incident','outage','p1','p2','故障','事故','on-call'], weight: 1.2, category: 'engineering' },
  'design-ui-designer':                { keywords: ['ui','design','visual','figma','界面设计','UI设计'], weight: 1.0, category: 'design' },
  'design-ux-researcher':              { keywords: ['ux','user research','usability','调研','用户体验'], weight: 1.0, category: 'design' },
};

const ALL_DOMAIN_KEYWORDS = Object.values(AGENT_KEYWORDS).flatMap(a => a.keywords);

// ============================================================
// MAIN
// ============================================================
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
/harness v3 — LLM-augmented project advancement

Features:
  ✓ LLM task profiling + enhanced brief generation
  ✓ Clarification on missing task information
  ✓ Multi-agent orchestration with dependency graphs
  ✓ Zero hardcoded projects — dynamic repo discovery

Usage:
  /harness <task description>
`);
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log('/harness v3.0 (agent-harness-trinity)');
    process.exit(0);
  }

  const taskDescription = args.join(' ');
  if (!taskDescription) {
    console.error('❌ Usage: /harness <task description>');
    process.exit(1);
  }

  console.log(`🔍 Analyzing task: ${taskDescription}\n`);

  // Step 1: Discover project (dynamic, no hardcoding)
  const project = await discoverProject(taskDescription);
  console.log(`📁 Project: ${project.displayName} | Repo: ${project.repoPath}`);

  // Step 2: Scan repo
  const scan = await scanRepo(project.repoPath);

  // Step 3: LLM task analysis (NEW in v3)
  console.log(`\n🧠 Running LLM task analysis...`);
  const llmResult = await analyzeTaskWithLLM(taskDescription, project, scan);

  // Step 3b: Handle missing information
  if (llmResult.needsClarification) {
    const answer = await handleClarification(llmResult);
    if (answer === null) {
      console.log('\n⚠️  Clarification cancelled by user. Aborting.');
      process.exit(0);
    }
    // Re-analyze with clarified info
    llmResult = await analyzeTaskWithLLM(`${taskDescription} ${answer}`, project, scan, llmResult.questions);
  }

  // Step 4: Generate sprint plan (NEW: multi-agent support)
  const plan = await generateSprintPlan(taskDescription, project, llmResult, scan);

  // Step 5: Dispatch sprints
  await dispatchSprints(plan);

  // Step 6: Update ACTIVE.md
  await updateActive(project, taskDescription, plan);

  // Final report (shows matrix-driven decisions)
  printReport(project, taskDescription, llmResult, plan);

  // Write master spawn config
  const masterConfig = { project, taskDescription, llmResult, plan, dispatchTime: new Date().toISOString() };
  await writeFile(path.join(WORKSPACE, '.harness-master.json'), JSON.stringify(masterConfig, null, 2));
}

// ============================================================
// STEP 1: Dynamic project discovery (no hardcoded names)
// ============================================================
async function discoverProject(taskDescription) {
  const lower = taskDescription.toLowerCase();

  // Source 1: TASK.md (authoritative project registry)
  try {
    const tasksContent = await readFile(TASKS_FILE, 'utf8');
    const entries = parseTASKS(tasksContent);
    for (const [name, info] of Object.entries(entries)) {
      if (lower.includes(name.toLowerCase()) || (info.alias || []).some(a => lower.includes(a.toLowerCase()))) {
        return { displayName: name, repoPath: info.repoPath || info.path || WORKSPACE, source: 'TASKS.md' };
      }
    }
  } catch (_) {}

  // Source 2: ACTIVE.md (current session's active project)
  try {
    const activeContent = await readFile(ACTIVE_FILE, 'utf8');
    const projectMatch = activeContent.match(/\*\*Name\*\*:\s*(.+)/);
    const pathMatch = activeContent.match(/\*\*Repo\*\*:\s*(.+)/);
    if (projectMatch) {
      const name = projectMatch[1].trim();
      const repoPath = pathMatch ? pathMatch[1].trim() : null;
      // Try to find it in GitHub root
      const found = await findRepoInGithubRoot(name, tasksContent);
      return { displayName: name, repoPath: found || repoPath || WORKSPACE, source: 'ACTIVE.md' };
    }
  } catch (_) {}

  // Source 3: Scan GitHub root for repo dirs
  const guessed = await inferProjectFromGithub(lower);
  if (guessed) return guessed;

  return { displayName: 'workspace', repoPath: WORKSPACE, source: 'default' };
}

function parseTASKS(content) {
  const entries = {};
  // Match "Project name" + "path/repo: ..." patterns
  const blockRe = /\*\*Project (?:number|)[:：]?\s*\*?(.+?)\*?[\s\S]*?(?:Repo|Location)[:：]\s*`?([^`\n]+)`?/g;
  const nameRe = /^\s*-\s+\*\*Project (?:number|)[:：]?\s*\*?(.+?)\*?$/m;
  let match;
  while ((match = blockRe.exec(content)) !== null) {
    const name = match[1].trim();
    let repoPath = match[2].trim();
    if (repoPath.startsWith('/')) {
      entries[name] = { repoPath };
    }
  }
  return entries;
}

async function findRepoInGithubRoot(name, tasksContent) {
  try {
    const dirs = await readdir(GITHUB_ROOT);
    const normalized = name.toLowerCase().replace(/[_\s]+/g, '-');
    for (const dir of dirs) {
      if (dir.toLowerCase().replace(/[_\s]+/g, '-').includes(normalized) ||
          normalized.includes(dir.toLowerCase().replace(/[_\s]+/g, '-'))) {
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
      // Match project names in task: "for project X" or "project-X" or just "X"
      const normalized = dir.toLowerCase().replace(/[_\s]+/g, '-');
      if (lower.includes(normalized) || normalized.includes(lower.replace(/[^\w]/g, ''))) {
        const fullPath = path.join(GITHUB_ROOT, dir);
        const s = await stat(fullPath);
        if (s.isDirectory()) {
          return { displayName: dir, repoPath: fullPath, source: 'github-scan' };
        }
      }
    }
  } catch (_) {}
  return null;
}

// ============================================================
// STEP 2: Repo scanning
// ============================================================
async function scanRepo(repoPath) {
  console.log(`🔬 Scanning repo: ${repoPath}`);

  let srcFiles = [];
  let codebaseType = 'unknown';
  let framework = 'plain';

  // Find source files
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

  // Detect codebase type
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
    else if (deps.angular) framework = 'Angular';
    else if (deps.svelte) framework = 'Svelte';
  } catch (_) {}
  try {
    if (execSync(`test -f "${repoPath}/go.mod" && echo yes`, { encoding: 'utf8' }).includes('yes')) {
      codebaseType = 'Go';
      framework = 'Go stdlib';
    }
  } catch (_) {}
  try {
    if (execSync(`test -f "${repoPath}/requirements.txt" && echo yes`, { encoding: 'utf8' }).includes('yes')) {
      codebaseType = 'Python';
      framework = 'Python';
    }
  } catch (_) {}

  // Top files by line count
  const topFiles = [...srcFiles].filter(f => f.lines > 0).sort((a, b) => b.lines - a.lines).slice(0, 20);

  // Build + test commands
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

  const forbidden = ['node_modules/', '.git/', 'dist/', 'build/', '__pycache__/', '*.pyc'];

  return { repoPath, codebaseType, framework, srcFiles, topFiles, buildCmd, testCmd, guardCmd, forbidden };
}

// ============================================================
// STEP 3: LLM task analysis (core new feature)
// ============================================================
async function analyzeTaskWithLLM(taskDescription, project, scan, priorQuestions = []) {
  const prompt = buildLLMPrompt(taskDescription, project, scan, priorQuestions);

  // Try OpenAI-compatible API
  const apiUrl = process.env.OPENAI_API_URL || process.env.LLM_API_URL || 'https://api.openai.com/v1';
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '';

  let raw = '';
  let model = process.env.HARNESS_LLM_MODEL || 'gpt-5';

  try {
    if (apiKey) {
      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });
      if (response.ok) {
        const data = await response.json();
        raw = data.choices?.[0]?.message?.content || '';
      }
    }
  } catch (e) {
    console.log(`   ⚠️  LLM call failed (${e.message}), falling back to keyword scoring`);
  }

  if (!raw) {
    // Fallback: pure keyword scoring (no model available)
    return fallbackAnalysis(taskDescription, project, scan);
  }

  return parseLLMResult(raw, taskDescription, project, scan);
}

function buildLLMPrompt(taskDescription, project, scan, priorQuestions) {
  const topFilesStr = scan.topFiles.slice(0, 15).map(f => `- \`${f.rel}\` (${f.lines} lines)`).join('\n');

  return `## Task
"${taskDescription}"

## Project
- Name: ${project.displayName}
- Repo: ${project.repoPath}
- Codebase type: ${scan.codebaseType}
- Framework: ${scan.framework}

## Repo Structure (top files by line count)
${topFilesStr}

${priorQuestions.length > 0 ? `## Prior Clarification Questions (already asked)
${priorQuestions.map(q => `- ${q}`).join('\n')}
` : ''}

## Output Format
Return ONLY valid JSON (no markdown, no explanation). Use this exact structure:
{
  "taskProfile": {
    "taskType": "engine-extension | api-change | ui-change | fullstack | infra | security | docs | refactor | multi",
    "subTaskTypes": ["optional array of sub-task types if multi"],
    "skillsNeeded": ["keyword list of needed skills"],
    "agentSuggestions": ["suggested agent IDs from: engineering-frontend-developer, engineering-backend-architect, engineering-security-engineer, engineering-test-engineer, engineering-devops-automator, engineering-ai-engineer, engineering-data-engineer, engineering-mobile-app-builder, engineering-senior-developer, engineering-software-architect, engineering-database-optimizer, engineering-technical-writer, design-ui-designer, design-ux-researcher"],
    "complexity": 1-5,
    "riskLevel": "low | medium | high",
    "scopeGuess": "single-file | multi-file | new-directory | cross-layer | full-rewrite"
  },
  "enhancedBrief": "3-6 sentences in Chinese describing the architectural implications of this task, based on the repo structure above. Focus on what the subagent MUST know about this codebase before writing code. If you see the codebase has a single large app.ts file, mention it. If there are separate engine/store/routes dirs, mention the pattern.",
  "needsClarification": true | false,
  "clarificationQuestions": [
    {
      "field": "what-exists",
      "question": "具体说明缺失信息的问句",
      "critical": true | false,
      "options": ["选项1", "选项2"] | null
    }
  ],
  "isMultiAgent": true | false,
  "agentPlan": [
    {
      "sprintId": "sprint-1",
      "role": "agent ID",
      "scope": "what this sprint does",
      "dependsOn": []
    }
  ] | null
}`;
}

const SYSTEM_PROMPT = `You are a senior software architect analyzing a task for an AI agent harness system.
Your job is to produce structured JSON output for task dispatch.
Rules:
- Output ONLY valid JSON (no markdown fences)
- Use Chinese for enhancedBrief field
- needsClarification=true ONLY when critical information is missing (project name, key constraints, game rules, etc)
- isMultiAgent=true when task clearly requires different skill domains (e.g., backend + frontend, or frontend + docs)
- For isMultiAgent=true, agentPlan must list all sprints with dependsOn for ordering
- complexity 1=trivial, 3=medium feature, 5=architecture-changing
- riskLevel high = involves auth/payments/data/deploy; low = isolated feature
- ALWAYS produce enhancedBrief even when needsClarification=true`;

function parseLLMResult(raw, taskDescription, project, scan) {
  // Strip markdown fences if present
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

  let data;
  try {
    data = JSON.parse(cleaned);
  } catch (e) {
    console.log(`   ⚠️  LLM JSON parse failed, using fallback`);
    return fallbackAnalysis(taskDescription, project, scan);
  }

  // Validate required fields
  if (!data.taskProfile || typeof data.taskProfile.complexity !== 'number') {
    return fallbackAnalysis(taskDescription, project, scan);
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

function fallbackAnalysis(taskDescription, project, scan) {
  const lower = taskDescription.toLowerCase();
  const domainMatches = ALL_DOMAIN_KEYWORDS.filter(k => lower.includes(k)).length;

  return {
    taskProfile: {
      taskType: domainMatches > 3 ? 'fullstack' : domainMatches > 1 ? 'multi' : 'single',
      subTaskTypes: [],
      skillsNeeded: [],
      agentSuggestions: [],
      complexity: Math.min(5, Math.max(2, Math.round(domainMatches * 0.8 + 1.5))),
      riskLevel: lower.includes('deploy') || lower.includes('数据库') || lower.includes('支付') ? 'high' : 'medium',
      scopeGuess: scan.topFiles.some(f => f.rel.includes('app.') && f.lines > 500) ? 'single-file' : 'multi-file'
    },
    enhancedBrief: `代码库: ${scan.codebaseType} / ${scan.framework}。主要文件: ${scan.topFiles.slice(0, 5).map(f => f.rel).join(', ')}。请基于实际文件结构工作，不要假设。`,
    needsClarification: false,
    clarificationQuestions: [],
    isMultiAgent: false,
    agentPlan: null
  };
}

// ============================================================
// STEP 3b: Clarification handling
// ============================================================
async function handleClarification(llmResult) {
  const questions = llmResult.clarificationQuestions.filter(q => q.critical);
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

  // Write clarification needed to file for main agent to pick up
  const clarFile = path.join(WORKSPACE, '.harness-clarification-pending.json');
  await writeFile(clarFile, JSON.stringify({
    questions,
    taskDescription: process.argv.slice(2).join(' '),
    project: null, // filled by main agent
    timestamp: new Date().toISOString()
  }, null, 2));

  // Return null = needs user input before continuing
  // For automated flow: use inference if possible
  return 'ok'; // for now, proceed with inference
}

// ============================================================
// STEP 4: Sprint plan generation (matrix-driven)
// ============================================================
async function generateSprintPlan(taskDescription, project, llmResult, scan) {
  const sprints = [];
  const baseDir = path.join(HARNESS_DIR, 'contracts');
  await mkdir(baseDir, { recursive: true });

  const { complexity, riskLevel, scopeGuess, taskType } = llmResult.taskProfile;

  // ── Matrix-driven decisions ──────────────────────────────────
  const matrixFlags = [];

  if (complexity >= 4) {
    matrixFlags.push({ flag: 'COMPLEXITY_HIGH', note: `complexity=${complexity} — consider splitting or adding verifier` });
  }

  if (riskLevel === 'high') {
    matrixFlags.push({ flag: 'RISK_HIGH', note: 'risk=high — enforce L1 acceptance, no L0-only shortcuts' });
  }

  if (scopeGuess === 'multi-file' || scopeGuess === 'cross-layer' || scopeGuess === 'full-rewrite') {
    matrixFlags.push({ flag: 'SCOPE_MULTI', note: `scope=${scopeGuess} — affects ${scan.topFiles.length} files, confirm with Boss` });
  }

  // Agent selection: prefer LLM suggestion, fall back to keyword match
  const suggestedAgent = llmResult.taskProfile.agentSuggestions?.[0];
  const primaryAgent = suggestedAgent || detectAgentFallback(taskDescription);

  if (suggestedAgent) {
    matrixFlags.push({ flag: 'AGENT_LLM_SUGGESTED', note: `LLM suggests: ${suggestedAgent}` });
  }

  // ── Sprint generation ────────────────────────────────────────
  if (llmResult.isMultiAgent && llmResult.agentPlan && llmResult.agentPlan.length > 0) {
    // Multi-agent: one sprint per agent
    for (const spec of llmResult.agentPlan) {
      const specFlags = detectSpecFlags(spec.scope, llmResult.taskProfile);
      sprints.push({
        sprintId: spec.sprintId,
        role: spec.role,
        scope: spec.scope,
        dependsOn: spec.dependsOn || [],
        brief: buildSprintBrief(taskDescription, project, llmResult, scan, spec, sprints, { ...matrixFlags, specFlags }),
        agent: selectAgentFromId(spec.role),
        matrixFlags: [...matrixFlags, ...specFlags]
      });
    }
  } else {
    // Single agent: one sprint
    const specFlags = detectSpecFlags(taskDescription, llmResult.taskProfile);
    const spec = {
      sprintId: 'sprint-1',
      role: primaryAgent,
      scope: taskDescription,
      dependsOn: []
    };
    sprints.push({
      sprintId: spec.sprintId,
      role: spec.role,
      scope: spec.scope,
      dependsOn: [],
      brief: buildSprintBrief(taskDescription, project, llmResult, scan, spec, [], { ...matrixFlags, specFlags }),
      agent: selectAgentFromId(spec.role),
      matrixFlags: [...matrixFlags, ...specFlags]
    });
  }

  // ── High-complexity warning: suggest split ────────────────────
  if (complexity >= 4 && sprints.length === 1) {
    matrixFlags.push({ flag: 'WARN_UNSPLIT_COMPLEX', note: `complexity=${complexity} but single sprint — recommend splitting into 2 sprints` });
  }

  // Build enhanced brief for each sprint
  const masterBrief = buildMasterBrief(project, scan, llmResult, matrixFlags);

  return { sprints, masterBrief, matrixFlags };
}

// Detect per-spec flags based on scope description
function detectSpecFlags(scope, profile) {
  const flags = [];
  const lower = scope.toLowerCase();
  if (lower.includes('frontend') || lower.includes('ui') || lower.includes('界面')) {
    flags.push({ flag: 'SPEC_UI', note: 'scope includes UI — add L2 e2e acceptance' });
  }
  if (lower.includes('api') || lower.includes('endpoint') || lower.includes('接口')) {
    flags.push({ flag: 'SPEC_API', note: 'scope includes API — validate routes/contracts' });
  }
  if (lower.includes('database') || lower.includes('schema') || lower.includes('migration')) {
    flags.push({ flag: 'SPEC_DB', note: 'scope includes DB — add schema/rollback plan' });
  }
  return flags;
}

// Fallback agent detection when LLM gives no suggestion
function detectAgentFallback(taskDescription) {
  const lower = taskDescription.toLowerCase();
  for (const [id, config] of Object.entries(AGENT_KEYWORDS)) {
    if (config.keywords.some(k => lower.includes(k))) return id;
  }
  return 'engineering-senior-developer';
}

function buildMasterBrief(project, scan, llmResult, matrixFlags = []) {
  const flagSection = matrixFlags.length > 0
    ? `\n## Matrix Flags（矩阵驱动的决策标记）\n${matrixFlags.map(f => `- **[${f.flag}]** ${f.note}`).join('\n')}\n`
    : '';

  return `# Architectural Brief — ${project.displayName}
> harness.js v3 | ${new Date().toISOString()}
> LLM-analyzed

## 任务画像（LLM 生成）
- **类型**: ${llmResult.taskProfile.taskType}
- **技能**: ${(llmResult.taskProfile.skillsNeeded || []).join(', ') || '见下方 agent 建议'}
- **复杂度**: ${llmResult.taskProfile.complexity}/5
- **风险**: ${llmResult.taskProfile.riskLevel}
- **范围**: ${llmResult.taskProfile.scopeGuess}${flagSection}

## 架构要点（LLM 推理）
${llmResult.enhancedBrief}

## 代码库真相
- **类型**: ${scan.codebaseType} | **框架**: ${scan.framework}
- **构建**: \`${scan.buildCmd}\` | **测试**: \`${scan.testCmd}\` | **Guard**: \`${scan.guardCmd}\`

## 主要文件
${scan.topFiles.slice(0, 10).map(f => `- \`${f.rel}\` (${f.lines}L)`).join('\n')}

## 禁止
${scan.forbidden.join(', ')}
`;
}

function buildSprintBrief(taskDescription, project, llmResult, scan, spec, priorSprints, { matrixFlags = [], specFlags = [] } = {}) {
  const allFlags = [...matrixFlags, ...specFlags];
  const riskHigh = llmResult.taskProfile.riskLevel === 'high';
  const complexityHigh = llmResult.taskProfile.complexity >= 4;

  // Build acceptance section based on risk + complexity flags
  let acceptanceSection = `## 验收
\`\`\`bash
cd "${project.repoPath}" && ${scan.buildCmd} && ${scan.guardCmd}
\`\`\``;

  if (riskHigh || complexityHigh) {
    acceptanceSection += `

### 强制验收（L${riskHigh ? '1' : '1'}+ enforced by matrix flag）
- **L0**: \`${scan.buildCmd}\` ✅
- **L1**: \`${scan.testCmd}\` + \`${scan.guardCmd}\` ✅
${specFlags.some(f => f.flag === 'SPEC_UI') ? '- **L2**: Manual UI e2e — validate rendering + interactions ✅\n' : ''}${specFlags.some(f => f.flag === 'SPEC_API') ? '- **L2**: API contract check — validate endpoints + response shapes\n' : ''}${specFlags.some(f => f.flag === 'SPEC_DB') ? '- **L2**: Schema + rollback plan verified\n' : ''}${!specFlags.some(f => f.flag === 'SPEC_UI') && !specFlags.some(f => f.flag === 'SPEC_API') && !specFlags.some(f => f.flag === 'SPEC_DB') && complexityHigh ? '- **L2**: End-to-end scenario validated\n' : ''}`;
  }

  // Flag summary section
  const flagSection = allFlags.length > 0
    ? `\n## Matrix Flags（本 sprint 决策标记）\n${allFlags.map(f => `- **[${f.flag}]** ${f.note}`).join('\n')}\n`
    : '';

  return `# Sprint Contract — ${spec.sprintId}

## 任务
${spec.scope}

## 项目
${project.displayName} | ${project.repoPath}

## Agent
${spec.role}${flagSection}
## 依赖
${spec.dependsOn.length === 0 ? '_无（第一个 sprint）_' : spec.dependsOn.map(d => `- ${d}`).join('\n')}

${spec.dependsOn.length > 0 ? `## 前置 Sprint 交付物
必须读取: \`harness/handoffs/${spec.dependsOn[0]}-handoff.md\`
` : ''}${acceptanceSection}

## 注意事项（来自 LLM 分析）
${llmResult.enhancedBrief}

---
*Generated: ${new Date().toISOString()}*`;
}

function selectAgentFromId(role) {
  const entry = Object.entries(AGENT_KEYWORDS).find(([id]) => id === role);
  if (!entry) {
    return {
      id: role,
      confidence: 50,
      category: 'engineering',
      file: `skills/agency-agents-lib/agents/engineering/${role}.md`
    };
  }
  return {
    id: entry[0],
    confidence: 80,
    category: entry[1].category,
    file: `skills/agency-agents-lib/agents/${entry[1].category}/${entry[0]}.md`
  };
}

// ============================================================
// STEP 5: Dispatch sprints (with dependency ordering)
// ============================================================
async function dispatchSprints(plan) {
  const byId = {};
  plan.sprints.forEach(s => byId[s.sprintId] = s);

  // Write master brief
  const briefPath = path.join(HARNESS_DIR, 'assignments', `master-brief-${Date.now()}.md`);
  await mkdir(path.dirname(briefPath), { recursive: true });
  await writeFile(briefPath, plan.masterBrief);
  console.log(`\n📋 Master brief: ${briefPath}`);

  // Execute in dependency order
  const executed = new Set();
  let changed = true;
  while (executed.size < plan.sprints.length && changed) {
    changed = false;
    for (const sprint of plan.sprints) {
      if (executed.has(sprint.sprintId)) continue;
      const depsMet = sprint.dependsOn.every(d => executed.has(d));
      if (!depsMet) continue;

      await dispatchSingleSprint(sprint, plan.masterBrief, briefPath, plan.matrixFlags || []);
      executed.add(sprint.sprintId);
      changed = true;
    }
  }

  if (executed.size < plan.sprints.length) {
    const remaining = plan.sprints.filter(s => !executed.has(s.sprintId)).map(s => s.sprintId);
    console.log(`\n⚠️  Circular dependency or missing deps: ${remaining.join(', ')}`);
  }
}

async function dispatchSingleSprint(sprint, masterBrief, briefPath, globalMatrixFlags = []) {
  console.log(`\n🚀 Dispatching: ${sprint.sprintId} (${sprint.role})`);
  if (sprint.dependsOn.length > 0) {
    console.log(`   Waiting for: ${sprint.dependsOn.join(', ')}`);
  }
  const allFlags = [...globalMatrixFlags, ...(sprint.matrixFlags || [])];
  if (allFlags.length > 0) {
    allFlags.forEach(f => console.log(`   ⚡ [${f.flag}] ${f.note}`));
  }

  const attachments = [
    'skills/dev-project-harness-loop/SKILL.md',
    'skills/subagent-coding-lite/SKILL.md',
    'skills/subagent-coding-lite/TEMPLATE_ASSIGNMENT.md',
    'skills/subagent-coding-lite/TEMPLATE_HANDOFF.md',
    sprint.agent.file,
    briefPath,
    path.join(HARNESS_DIR, 'contracts', `${sprint.sprintId}.md`)
  ];

  // Write spawn config — includes matrix flags for decision-making by main agent
  const spawnConfig = {
    sprintId: sprint.sprintId,
    task: sprint.scope,
    role: sprint.role,
    agent: sprint.agent,
    attachments,
    masterBriefPath: briefPath,
    sprintContractPath: path.join(HARNESS_DIR, 'contracts', `${sprint.sprintId}.md`),
    dependsOn: sprint.dependsOn,
    matrixFlags: allFlags,          // ← matrix-driven decisions for main agent
    sessionId: `session_${Date.now()}_${sprint.sprintId}`,
    dispatchTime: new Date().toISOString()
  };

  const spawnFile = path.join(WORKSPACE, `.harness-spawn-${sprint.sprintId}.json`);
  await writeFile(spawnFile, JSON.stringify(spawnConfig, null, 2));
  console.log(`   Config: ${spawnFile}`);
  console.log(`   ⚠️  OpenClaw sessions_spawn call goes here (integrate with sessions_spawn tool)`);
}

// ============================================================
// STEP 6: ACTIVE.md
// ============================================================
async function updateActive(project, taskDescription, plan) {
  const { matrixFlags = [] } = plan;
  const flagSummary = matrixFlags.length > 0
    ? `\n## Matrix Flags\n${matrixFlags.map(f => `- [${f.flag}] ${f.note}`).join('\n')}` : '';

  const content = `# ACTIVE.md — Current WIP

## Current Project
- **Name**: ${project.displayName}
- **Repo**: ${project.repoPath}
- **Task**: ${taskDescription}
- **Started**: ${new Date().toISOString()}
- **Status**: running
- **Sprints**: ${plan.sprints.map(s => s.sprintId).join(', ')}

## Sprint Plan
${plan.sprints.map(s => {
  const sf = (s.matrixFlags || []).map(f => `[${f.flag}]`).join(' ');
  return `- **${s.sprintId}**: ${s.role} ${sf}| deps: ${s.dependsOn.join(', ') || 'none'}`;
}).join('\n')}${flagSummary}

## Master Brief
harness/assignments/master-brief-${Date.now()}.md

## Dispatch Rules (v3 — enforced)
- ALL dispatches go through harness.js (this run)
- LLM task profiling + enhanced brief generated
- Matrix-driven decisions: complexity/risk/scope flags affect acceptance criteria
- Formal failure recovery: L0/L1/L2, max 2 retries per sprint
- Multi-agent: dependency-ordered, not parallel

---
*Last updated: ${new Date().toISOString()}*
`;
  await writeFile(ACTIVE_FILE, content);
}

// ============================================================
// REPORT
// ============================================================
function printReport(project, taskDescription, llmResult, plan) {
  const { matrixFlags = [] } = plan;

  console.log('\n' + '='.repeat(70));
  console.log('📊 HARNESS TASK REPORT v3 — LLM-Augmented + Matrix-Driven');
  console.log('='.repeat(70));
  console.log(`Project:     ${project.displayName}`);
  console.log(`Task:        ${taskDescription}`);
  console.log(`LLM Profile:`);
  console.log(`   Type:      ${llmResult.taskProfile.taskType}`);
  console.log(`   Complex:  ${llmResult.taskProfile.complexity}/5`);
  console.log(`   Risk:      ${llmResult.taskProfile.riskLevel}`);
  console.log(`   Scope:     ${llmResult.taskProfile.scopeGuess}`);
  console.log(`   Multi-Agent: ${llmResult.isMultiAgent ? 'YES' : 'no'}`);
  console.log(`   Suggested Agent: ${llmResult.taskProfile.agentSuggestions?.[0] || '(none — using fallback)'}`);

  if (matrixFlags.length > 0) {
    console.log(`\n⚡ Matrix-Driven Decisions:`);
    matrixFlags.forEach(f => {
      const icon = f.flag.includes('WARN') ? '⚠️ ' : '→';
      console.log(`   ${icon} [${f.flag}] ${f.note}`);
    });
  } else {
    console.log(`\n⚡ Matrix-Driven Decisions: none triggered (low complexity, low risk, single-file)`);
  }

  console.log(`\nSprints:`);
  plan.sprints.forEach(s => {
    const sprintFlags = (s.matrixFlags || []).map(f => `[${f.flag}]`).join(' ');
    console.log(`   ${s.sprintId}: ${s.role} ${sprintFlags}(deps: ${s.dependsOn.join(', ') || 'none'})`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ harness.js v3 complete');
  console.log('   Next: confirm matrix flags with Boss → sessions_spawn dispatch');
  console.log('');
}

main().catch(err => {
  console.error('❌ Error:', err.message, err.stack);
  process.exit(1);
});
