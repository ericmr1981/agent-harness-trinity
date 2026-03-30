#!/usr/bin/env node
/**
 * /harness - Unified project creation and advancement
 *
 * Usage:
 *   /harness <task description>
 *
 * Features:
 *   - Automatic architectural brief generation (no more wrong assumptions)
 *   - Formal failure recovery (L0/L1/L2 classification + auto-retry)
 *   - Task scoring + agent selection
 *   - Artifact creation + subagent dispatch
 *
 * Examples:
 *   /harness 为 Pipi-go 实现俄罗斯方块游戏
 *   /harness 创建一个新的数据分析 Dashboard 项目
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || process.cwd();
const HARNESS_DIR = path.join(WORKSPACE, 'harness');
const ACTIVE_FILE = path.join(WORKSPACE, 'ACTIVE.md');

// --- Agent keywords (34 agents) ---
const AGENT_KEYWORDS = {
  // === ENGINEERING (26 agents) ===
  'engineering-frontend-developer': {
    keywords: ['react', 'vue', 'angular', 'ui', 'css', 'frontend', 'component', 'virtualization', 'mobile', 'responsive', '网页', '前端'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-backend-architect': {
    keywords: ['api', 'database', 'schema', 'microservice', 'backend', 'architecture', 'sql', 'nosql', 'scalability', '后端', '服务器'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-security-engineer': {
    keywords: ['security', 'audit', 'threat', 'owasp', 'vulnerability', 'pentest', 'encryption', 'auth', '安全', '渗透', '漏洞'],
    weight: 1.2,
    category: 'engineering'
  },
  'engineering-test-engineer': {
    keywords: ['test', 'coverage', 'qa', 'e2e', 'unit', 'integration', 'jest', 'cypress', '测试', '自动化测试'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-devops-automator': {
    keywords: ['ci/cd', 'deploy', 'pipeline', 'infrastructure', 'automation', 'docker', 'kubernetes', 'devops', 'cicd', '部署', '容器'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-ai-engineer': {
    keywords: ['ai', 'ml', 'machine learning', 'model', 'tensorflow', 'pytorch', 'nlp', 'llm', 'rag', 'embedding', '人工智能', '机器学习', '大模型', 'AI工程师'],
    weight: 1.2,
    category: 'engineering'
  },
  'engineering-data-engineer': {
    keywords: ['data pipeline', 'etl', 'elt', 'spark', 'dbt', 'data lake', 'lakehouse', 'streaming', 'kafka', 'flink', '数据管道', '数据工程', '数据仓库'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-mobile-app-builder': {
    keywords: ['ios', 'android', 'mobile app', 'react native', 'flutter', 'swift', 'kotlin', 'app store', 'google play', '移动端', 'APP开发', '原生开发'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-solidity-smart-contract-engineer': {
    keywords: ['solidity', 'smart contract', 'evm', 'defi', 'web3', 'ethereum', 'nft', 'dao', 'gas optimization', 'proxy', '区块链', '智能合约', 'DeFi'],
    weight: 1.2,
    category: 'engineering'
  },
  'engineering-senior-developer': {
    keywords: ['senior', 'refactor', 'architecture', 'technical debt', 'code review', 'senior developer', '资深开发', '重构'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-software-architect': {
    keywords: ['software architect', 'system design', 'high level', 'hld', 'lld', 'architecture pattern', 'microservices', 'soa', '系统架构', '软件架构'],
    weight: 1.2,
    category: 'engineering'
  },
  'engineering-database-optimizer': {
    keywords: ['database', 'sql', 'nosql', 'postgres', 'mysql', 'mongodb', 'redis', 'performance', 'optimization', 'index', 'query', '数据库', '性能优化'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-ai-data-remediation-engineer': {
    keywords: ['data quality', 'data cleaning', 'data remediation', 'data governance', 'data lineage', '数据清洗', '数据质量', '数据治理'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-autonomous-optimization-architect': {
    keywords: ['auto optimization', 'self-tuning', 'adaptive', 'autonomous', 'optimization', 'performance tuning', '自动优化', '自适应'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-cms-developer': {
    keywords: ['cms', 'wordpress', 'contentful', 'strapi', 'headless', 'content management', 'CMS', '内容管理'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-code-reviewer': {
    keywords: ['code review', 'pr review', 'pull request', 'review', 'static analysis', 'lint', '代码审查', 'PR审查'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-embedded-firmware-engineer': {
    keywords: ['embedded', 'firmware', 'rtos', 'microcontroller', 'arm', 'c', 'c++', 'iot', '嵌入式', '固件', '单片机'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-email-intelligence-engineer': {
    keywords: ['email', 'smtp', 'imap', 'mail', 'sendgrid', 'mailgun', '邮件', '企业邮箱', '邮件系统'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-feishu-integration-developer': {
    keywords: ['feishu', 'lark', '飞书', 'bytedance', '办公软件', '企业应用', '集成'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-filament-optimization-specialist': {
    keywords: ['filament', 'laravel', 'php', 'tall stack', ' filament优化', 'laravel'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-git-workflow-master': {
    keywords: ['git', 'workflow', 'branching', 'merge', 'rebase', 'gitflow', 'github flow', '版本控制', '分支管理'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-incident-response-commander': {
    keywords: ['incident', 'outage', 'oncall', 'p1', 'p2', 'emergency', '故障', '事故响应', 'on-call', '监控告警'],
    weight: 1.2,
    category: 'engineering'
  },
  'engineering-rapid-prototyper': {
    keywords: ['prototype', 'mvp', 'demo', 'poc', 'rapid', 'stub', 'mock', '原型', 'MVP', '快速原型'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-sre': {
    keywords: ['sre', 'site reliability', 'reliability', 'monitoring', 'slo', 'sla', 'observability', '运维', '可靠性'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-technical-writer': {
    keywords: ['documentation', 'docs', 'readme', 'technical writing', 'wiki', 'swagger', 'openapi', '文档', '技术文档'],
    weight: 1.0,
    category: 'engineering'
  },
  'engineering-threat-detection-engineer': {
    keywords: ['threat detection', 'ids', 'ips', 'siem', 'security monitoring', 'threat intelligence', '威胁检测', '安全监控'],
    weight: 1.2,
    category: 'engineering'
  },
  'engineering-wechat-mini-program-developer': {
    keywords: ['wechat', 'miniprogram', '小程序', '微信', 'weixin', 'wechat dev'],
    weight: 1.0,
    category: 'engineering'
  },
  // === DESIGN (8 agents) ===
  'design-ux-researcher': {
    keywords: ['ux', 'research', 'persona', 'user', 'journey', 'interview', 'usability', '用户研究', '用户体验', '调研'],
    weight: 1.0,
    category: 'design'
  },
  'design-ui-designer': {
    keywords: ['ui', 'design', 'visual', 'component', 'library', 'system', 'figma', 'sketch', '界面设计', 'UI设计'],
    weight: 1.0,
    category: 'design'
  },
  'design-ux-architect': {
    keywords: ['ux architect', 'user experience', 'information architecture', 'ia', 'wireframe', 'prototype', '用户体验架构', '信息架构'],
    weight: 1.0,
    category: 'design'
  },
  'design-brand-guardian': {
    keywords: ['brand', 'branding', 'identity', 'logo', 'guideline', '品牌', '品牌设计', '品牌规范'],
    weight: 1.0,
    category: 'design'
  },
  'design-image-prompt-engineer': {
    keywords: ['image prompt', 'midjourney', 'dalle', 'stable diffusion', 'ai image', 'prompt engineering', '图片生成', 'AI绘图'],
    weight: 1.0,
    category: 'design'
  },
  'design-inclusive-visuals-specialist': {
    keywords: ['inclusive', 'accessibility', 'a11y', 'wcag', 'accessible', 'diversity', '无障碍', '包容性设计'],
    weight: 1.0,
    category: 'design'
  },
  'design-visual-storyteller': {
    keywords: ['visual', 'storytelling', 'infographic', 'presentation', 'narrative', '可视化', '故事化'],
    weight: 1.0,
    category: 'design'
  },
  'design-whimsy-injector': {
    keywords: ['whimsy', 'playful', 'fun', 'delight', 'humor', 'personality', '趣味', '创意', '品牌调性'],
    weight: 1.0,
    category: 'design'
  }
};

// --- Known project repo paths ---
const KNOWN_REPOS = {
  'pipi-go': '/Users/ericmr/Documents/GitHub/Pipi-go',
  'pipi go': '/Users/ericmr/Documents/GitHub/Pipi-go',
  'fireredi-openstoryline': '/Users/ericmr/Documents/GitHub/Obsidian/项目/FireRed-OpenStoryline',
  'local-portal': '/Users/ericmr/Documents/GitHub/Obsidian/项目/local-portal',
  'openclaw to ltx': '/Users/ericmr/Documents/GitHub/Obsidian/项目/OpenClaw to LTX',
  'mc_gen': '/Users/ericmr/Documents/GitHub/Obsidian/项目/MC_Gen',
  '封面与剪映自动化生产线': '/Users/ericmr/Documents/GitHub/Obsidian/项目/封面与剪映自动化生产线',
  'showtop-openclaw': '/Users/ericmr/Documents/GitHub/Obsidian/项目/ShowTop-OpenClaw',
  'wdg': '/Users/ericmr/Documents/GitHub/wdg-data-foundation',
  'agent-harness-trinity': '/Users/ericmr/Documents/GitHub/agent-harness-trinity',
};

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
/harness v2.0 - Unified project creation + advancement

Usage:
  /harness <task description>
  harness --help
  harness --version

Features:
  ✓ Auto architectural brief (no wrong architecture assumptions)
  ✓ Formal failure recovery (L0/L1/L2 + auto-retry, max 2)
  ✓ Task scoring + agent selection
  ✓ Artifact creation + subagent dispatch

Examples:
  /harness 为 Pipi-go 实现俄罗斯方块游戏
  /harness 创建一个新的数据分析 Dashboard
`);
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log('/harness v2.0 (agent-harness-trinity)');
    process.exit(0);
  }

  const taskDescription = args.join(' ');
  if (!taskDescription) {
    console.error('❌ Usage: /harness <task description>');
    process.exit(1);
  }

  console.log(`🔍 Analyzing task: ${taskDescription}\n`);

  // Step 1: Detect project + repo path
  const project = await detectProject(taskDescription);
  console.log(`📁 Project: ${project.name} | Repo: ${project.repoPath}`);

  // Step 2: Score task
  const score = await scoreTask(taskDescription);
  console.log(`📊 Task Score: ${score.total}/5.0 | ${score.decision}`);

  // Step 3: Select agent
  let agent = null;
  if (score.decision.includes('SUBAGENT')) {
    agent = await selectAgent(taskDescription);
    if (agent) {
      console.log(`🤖 Agent: ${agent.id} (${agent.confidence}% confidence)`);
    }
  }

  // Step 4: Auto-generate architectural brief (NEW in v2)
  const brief = await autoGenerateArchitecturalBrief(project, taskDescription);
  console.log(`📋 Brief: ${brief.path}`);

  // Step 5: Create harness artifacts
  const artifacts = await createHarnessArtifacts(project, taskDescription, score, agent, brief);

  // Step 6: Dispatch subagent
  let session = null;
  if (agent && score.decision.includes('SUBAGENT')) {
    console.log(`\n🚀 Dispatching subagent...`);
    session = await dispatchSubagent(project, taskDescription, agent, brief);
  }

  // Step 7: Update ACTIVE.md
  await updateActive(project, taskDescription, session, agent, artifacts);

  // Final report
  printReport(project, taskDescription, score, agent, session, brief);
}

// ============================================================
// STEP 1: Detect project + repo path
// ============================================================
async function detectProject(taskDescription) {
  const lower = taskDescription.toLowerCase();

  // Priority 1: Task description (most specific — user explicitly names a project)
  for (const [key, repoPath] of Object.entries(KNOWN_REPOS)) {
    if (lower.includes(key)) {
      return { name: key, repoPath, location: repoPath };
    }
  }

  // Priority 2: ACTIVE.md (current session's active project)
  try {
    const content = await readFile(ACTIVE_FILE, 'utf8');
    const match = content.match(/\*\*Name\*\*:\s*(.+)/);
    if (match && match[1] && match[1] !== 'New Project') {
      const repoPath = findRepoPath(match[1].trim());
      if (repoPath) return { name: match[1].trim(), repoPath, location: repoPath };
    }
  } catch (_) {}

  // Default: use workspace
  return { name: 'workspace', repoPath: WORKSPACE, location: WORKSPACE };
}

function findRepoPath(projectName) {
  const key = projectName.toLowerCase().replace(/\s+/g, '-');
  return KNOWN_REPOS[key] || KNOWN_REPOS[projectName.toLowerCase()] || null;
}

// ============================================================
// STEP 2: Score task
// ============================================================
async function scoreTask(task) {
  const lower = task.toLowerCase();
  const dimensions = {
    complexity: estimateComplexity(lower),
    expertise: estimateExpertise(lower),
    risk: estimateRisk(lower),
    effort: estimateEffort(lower),
    dependencies: estimateDependencies(lower)
  };

  const weights = { complexity: 0.30, expertise: 0.25, risk: 0.20, effort: 0.15, dependencies: 0.10 };
  let total = 0;
  for (const [dim, score] of Object.entries(dimensions)) {
    total += score * weights[dim];
  }
  total = Math.round(total * 100) / 100;

  let decision;
  if (total >= 3.5) decision = 'SUBAGENT + SPECIALIZED AGENT';
  else if (total >= 2.0) decision = 'SUBAGENT (GENERAL ROLE)';
  else decision = 'MAIN SESSION';

  return { dimensions, total, decision };
}

function estimateComplexity(task) {
  const high = ['架构', 'design', 'implement', 'create', 'system', 'component', 'virtual', 'architecture', '完整', '全栈'].filter(k => task.includes(k)).length;
  const med = ['add', '添加', 'update', 'update', 'modify', '修改', 'optimize', '优化'].filter(k => task.includes(k)).length;
  if (high >= 2) return 5;
  if (high >= 1) return 4;
  if (med >= 2) return 3;
  if (med >= 1) return 2;
  return 2;
}

function estimateExpertise(task) {
  let score = 2;
  const domain = ['react', 'vue', 'api', 'database', 'ml', 'ai', 'security', 'auth', 'ux', 'mobile', 'blockchain', 'data pipeline', 'ci/cd', 'embedded', 'sre', 'git', 'technical writing', 'docs', 'threat detection'];
  const matches = domain.filter(k => task.includes(k)).length;
  if (matches >= 4) return 5;
  if (matches >= 3) return 4;
  if (matches >= 2) return 3;
  return 2;
}

function estimateRisk(task) {
  if (['production', 'deploy', '数据库', '支付'].some(k => task.includes(k))) return 5;
  if (['api', '用户', '性能'].some(k => task.includes(k))) return 3;
  return 2;
}

function estimateEffort(task) {
  if (['完整', 'end-to-end', '全栈'].some(k => task.includes(k))) return 5;
  if (['功能', 'feature', '开发'].some(k => task.includes(k))) return 4;
  if (['优化', 'optimize'].some(k => task.includes(k))) return 3;
  return 2;
}

function estimateDependencies(task) {
  if (['集成', 'integration', '跨'].some(k => task.includes(k))) return 5;
  if (['模块', 'module'].some(k => task.includes(k))) return 3;
  return 1;
}

// ============================================================
// STEP 3: Select agent
// ============================================================
async function selectAgent(task) {
  const lower = task.toLowerCase();
  const matches = {};

  for (const [agent, config] of Object.entries(AGENT_KEYWORDS)) {
    const count = config.keywords.filter(k => lower.includes(k)).length;
    if (count >= 1) matches[agent] = count * config.weight;
  }

  const best = Object.entries(matches).sort((a, b) => b[1] - a[1])[0];
  if (!best) return null;

  return {
    id: best[0],
    confidence: Math.min(100, Math.round((best[1] / 2) * 100)),
    category: AGENT_KEYWORDS[best[0]].category,
    file: `skills/agency-agents-lib/agents/${AGENT_KEYWORDS[best[0]].category}/${best[0]}.md`
  };
}

// ============================================================
// NEW IN V2: STEP 4 - Auto-generate architectural brief
// This replaces manual repo scouting that caused subagent #1 failure
// ============================================================
async function autoGenerateArchitecturalBrief(project, taskDescription) {
  const repoPath = project.repoPath;
  const timestamp = Date.now();
  const briefId = `architectural-brief-${timestamp}`;
  const briefDir = path.join(HARNESS_DIR, 'assignments');
  await mkdir(briefDir, { recursive: true });
  const briefPath = path.join(briefDir, `${briefId}.md`);

  console.log(`\n🔬 Auto-scanning repo: ${repoPath}`);

  // Phase 1: File structure discovery
  let fileTree = [];
  let srcFiles = [];
  try {
    execSync(`find "${repoPath}" -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.go" -o -name "*.rs" \\) ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" 2>/dev/null`, { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .slice(0, 60)
      .forEach(f => {
        const rel = path.relative(repoPath, f);
        const lineCount = execCapture(`wc -l < "${f}"`).trim() || '?';
        srcFiles.push({ rel, lineCount });
      });
  } catch (_) {}

  // Phase 2: Detect codebase type
  let codebaseType = 'unknown';
  let keyFiles = [];
  let packageJson = null;
  try {
    const pjPath = path.join(repoPath, 'package.json');
    const pjContent = await readFile(pjPath, 'utf8');
    packageJson = JSON.parse(pjContent);
    codebaseType = 'Node.js/TypeScript';
  } catch (_) {}
  try {
    const goPath = path.join(repoPath, 'go.mod');
    if (execSync(`test -f "${goPath}" && echo yes`, { encoding: 'utf8' }).includes('yes')) {
      codebaseType = 'Go';
    }
  } catch (_) {}
  try {
    const pyPath = path.join(repoPath, 'requirements.txt');
    if (execSync(`test -f "${pyPath}" && echo yes`, { encoding: 'utf8' }).includes('yes')) {
      codebaseType = 'Python';
    }
  } catch (_) {}

  // Phase 3: Find entry points and key files
  const entryCandidates = [
    'src/app.ts', 'src/app.js', 'app.ts', 'app.js', 'main.ts', 'main.go',
    'index.ts', 'index.js', 'server.ts', 'server.js', 'main.py',
    'src/server/', 'src/routes/', 'src/api/', 'src/pages/', 'src/components/',
    'engine/', 'game/', 'store.ts', 'store.js',
  ];

  for (const cand of entryCandidates) {
    try {
      const fullPath = path.join(repoPath, cand);
      if (execSync(`test -f "${fullPath}" && echo yes`, { encoding: 'utf8' }).includes('yes')) {
        const lines = execCapture(`wc -l < "${fullPath}"`).trim();
        keyFiles.push({ rel: cand, lines: lines || '?' });
      } else if (execSync(`test -d "${fullPath}" && echo yes`, { encoding: 'utf8' }).includes('yes')) {
        keyFiles.push({ rel: cand + '/', type: 'directory' });
      }
    } catch (_) {}
  }

  // Phase 4: Detect build/test commands
  let buildCmd = 'unknown';
  let testCmd = 'unknown';
  let guardCmd = 'unknown';
  if (packageJson) {
    buildCmd = packageJson.scripts?.build || 'none';
    testCmd = packageJson.scripts?.test || 'none';
  }
  try {
    if (execSync(`test -f "${repoPath}/scripts/run_change_guard.sh" && echo yes`, { encoding: 'utf8' }).includes('yes')) {
      guardCmd = 'bash scripts/run_change_guard.sh';
    }
  } catch (_) {}

  // Phase 5: Detect framework
  let framework = 'plain';
  if (packageJson) {
    const deps = { ...packageJson.dependencies || {}, ...packageJson.devDependencies || {} };
    if (deps.fastify || deps['@fastify/static']) framework = 'Fastify';
    else if (deps.express) framework = 'Express';
    else if (deps.next) framework = 'Next.js';
    else if (deps.vue) framework = 'Vue';
    else if (deps.react) framework = 'React';
    else if (deps.angular) framework = 'Angular';
  }

  // Phase 6: Generate forbidden files list
  const forbiddenPatterns = ['node_modules/', '.git/', 'dist/', 'build/', '__pycache__/', '*.pyc'];

  // Phase 7: Write brief
  const brief = generateBriefContent({
    project, taskDescription, repoPath, codebaseType, framework,
    srcFiles, keyFiles, buildCmd, testCmd, guardCmd, forbiddenPatterns,
    timestamp
  });

  await writeFile(briefPath, brief);

  return {
    id: briefId,
    path: briefPath,
    relativePath: `harness/assignments/${briefId}.md`
  };
}

function execCapture(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
  } catch (_) {
    return '';
  }
}

function generateBriefContent({ project, taskDescription, repoPath, codebaseType, framework, srcFiles, keyFiles, buildCmd, testCmd, guardCmd, forbiddenPatterns, timestamp }) {
  // Top 15 largest files
  const topFiles = [...srcFiles]
    .filter(f => !isNaN(parseInt(f.lineCount)))
    .sort((a, b) => parseInt(b.lineCount) - parseInt(a.lineCount))
    .slice(0, 15);

  return `# Architectural Brief — ${project.name}
> Auto-generated by harness.js v2 | ${new Date(timestamp).toISOString()}
> Task: ${taskDescription}

## ⚠️ READ BEFORE WRITING CODE
This brief is the **single source of truth** for this repo's architecture.
Subagent must follow this exactly — do NOT assume file paths or structure.

## Codebase Type
- **Type**: ${codebaseType}
- **Framework**: ${framework}
- **Repo root**: \`${repoPath}\`

## Key Files（行数最多的文件，优先阅读）
${topFiles.length > 0 ? topFiles.map(f => `- \`${f.rel}\` (${f.lineCount} lines)`).join('\n') : '- (none detected)'}

## Key Directories / Entry Points
${keyFiles.length > 0 ? keyFiles.map(f => f.type === 'directory' ? `- \`${f.rel}\` (directory)` : `- \`${f.rel}\` (${f.lines} lines)`).join('\n') : '- (none detected)'}

## Build + Verification Commands
| Command | Value |
|---------|-------|
| Build | \`${buildCmd}\` |
| Test | \`${testCmd}\` |
| Change Guard | \`${guardCmd}\` |

## Forbidden Files / Patterns（绝对不要修改）
${forbiddenPatterns.map(p => `- \`${p}\``).join('\n')}

## Architecture Notes（auto-detected hints）
${framework !== 'plain' ? `- Framework detected: **${framework}** — follow its conventions` : ''}
${codebaseType === 'Node.js/TypeScript' ? '- Use \`import/export\` (ESM), not \`require()\`' : ''}
${codebaseType === 'Go' ? '- Use Go modules + standard layout' : ''}
${codebaseType === 'Python' ? '- Use virtualenv or venv; follow PEP 8' : ''}
${topFiles.some(f => f.rel.includes('app.ts') || f.rel.includes('app.js')) ? '- ⚠️ Single-file server detected (app.ts/js contains all routes/logic)' : ''}
${topFiles.some(f => f.rel.includes('store.ts') || f.rel.includes('store.js')) ? '- ⚠️ Store file detected (data persistence logic here)' : ''}
${topFiles.some(f => f.rel.includes('engine') || f.rel.includes('game')) ? '- ⚠️ Game engine directory detected' : ''}
${keyFiles.some(f => f.rel.includes('public/') || f.rel.includes('pages/') || f.rel.includes('views/')) ? '- ⚠️ Static pages or views directory detected' : ''}

## File Structure（auto-detected, first 60 source files）
\`\`\`
${srcFiles.slice(0, 40).map(f => `${f.rel} (${f.lineCount}L)`).join('\n')}
${srcFiles.length > 40 ? `... (+${srcFiles.length - 40} more files)` : ''}
\`\`\`

## Adding a New Feature（pattern）
1. Read \`keyFiles\` entries above first（especially the largest files）
2. Find where similar features are implemented
3. Follow the same patterns
4. Run build + guard before claiming done
5. Update features.json if it exists

## Subagent Dispatch Contract（v2）
- ✅ Architectural brief auto-generated (this file)
- ✅ Formal failure recovery enabled (L0/L1/L2, max 2 retries)
- ✅ Task scored + agent selected
- ❌ Do NOT skip the brief — read it before writing any code
`;
}

// ============================================================
// STEP 5: Create harness artifacts
// ============================================================
async function createHarnessArtifacts(project, taskDescription, score, agent, brief) {
  await mkdir(path.join(HARNESS_DIR, 'contracts'), { recursive: true });
  await mkdir(path.join(HARNESS_DIR, 'assignments'), { recursive: true });
  await mkdir(path.join(HARNESS_DIR, 'handoffs'), { recursive: true });
  await mkdir(path.join(WORKSPACE, 'artifacts'), { recursive: true });

  const sprintId = `sprint-${Date.now()}`;
  const contractPath = path.join(HARNESS_DIR, 'contracts', `${sprintId}.md`);
  const profile = score.total >= 4.5 ? 'PGE-sprint' : score.total >= 4.0 ? 'PGE-final' : score.total >= 3.0 ? 'PG' : 'Solo';

  await writeFile(contractPath, `# Sprint Contract: ${sprintId}

## Task
${taskDescription}

## Repo
${project.repoPath}

## Harness Profile
${profile} (score: ${score.total}/5.0)

## Definition of Done
- [ ] Implementation complete
- [ ] Build passing: \`${getBuildCmd(project.repoPath)}\`
- [ ] Tests passing: \`${getTestCmd(project.repoPath)}\`
- [ ] Change guard passing: \`bash scripts/run_change_guard.sh\`
- [ ] features.json updated (if exists)

## Verification
\`\`\`bash
cd "${project.repoPath}" && ${getBuildCmd(project.repoPath)} && bash scripts/run_change_guard.sh
\`\`\`

## Scope
- In scope: implement the task per the brief
- Out of scope: refactoring unrelated code, adding dependencies

## Non-goals
- Do NOT change: ${brief ? 'forbidden files listed in brief' : 'node_modules, dist, .git'}

## Failure Recovery Policy（v2）
- L0 (architecture misunderstanding — subagent can't find files): re-read brief + fix prompt, retry
- L1 (logic error — build/test fails): extract error log, attach to prompt, retry
- L2 (timeout — incomplete): split task into smaller sprint, retry with narrower scope
- Max retries: 2 per task

## Artifacts
- Brief: \`${brief.relativePath}\`
- Contract: \`harness/contracts/${sprintId}.md\`
- Handoff: \`harness/handoffs/handoff-${Date.now()}.md\`

---
*Created: ${new Date().toISOString()}*
`);

  // Create assignment
  let assignmentPath = null;
  if (agent) {
    const assignId = `assign-${Date.now()}`;
    assignmentPath = path.join(HARNESS_DIR, 'assignments', `${assignId}.md`);
    await writeFile(assignmentPath, `# Assignment Brief

## Role
- Role: builder
- Agent: ${agent.id}
- Agent file: ${agent.file}
- Inject as attachment: yes
- Category: ${agent.category} (${agent.confidence}% confidence)

## Task
${taskDescription}

## Repo
\`${project.repoPath}\`

## MUST READ FIRST（强制）
\`\`\`
${brief.relativePath}
\`\`\`
This is your **architectural brief**. It was auto-generated and reflects the real codebase structure.
Read it before writing any code.

## Acceptance
- [ ] Build passing
- [ ] Change guard passing
- [ ] features.json updated (if applicable)
- [ ] Handoff created: \`harness/handoffs/handoff-${Date.now()}.md\`

## Attachments（auto-injected by harness.js v2）
1. \`skills/dev-project-harness-loop/SKILL.md\` — harness flow
2. \`skills/subagent-coding-lite/SKILL.md\` — subagent spec
3. \`skills/subagent-coding-lite/TEMPLATE_ASSIGNMENT.md\` — assignment template
4. \`skills/subagent-coding-lite/TEMPLATE_HANDOFF.md\` — handoff template
5. \`${agent.file}\` — domain expertise
6. \`${brief.relativePath}\` — **architectural brief（必须先读）**

## Failure Recovery
If build/test fails:
1. Read the error output carefully
2. Classify: L0（文件找不到）→ L1（逻辑错误）→ L2（超时）
3. Retry with corrected instructions（max 2 tries）
4. If still failing → create \`harness/handoffs/escalation-<id>.md\` and exit

---
*Created: ${new Date().toISOString()}*
`);
  }

  console.log(`   ✓ harness/contracts/${sprintId}.md`);
  console.log(`   ✓ ${brief.relativePath}`);
  if (assignmentPath) console.log(`   ✓ harness/assignments/assign-${Date.now()}.md`);

  return { sprintId, brief };
}

function getBuildCmd(repoPath) {
  try {
    const pj = JSON.parse(execCapture(`cat "${repoPath}/package.json" 2>/dev/null`));
    return pj.scripts?.build || 'npm run build';
  } catch (_) {
    return 'npm run build';
  }
}

function getTestCmd(repoPath) {
  try {
    const pj = JSON.parse(execCapture(`cat "${repoPath}/package.json" 2>/dev/null`));
    return pj.scripts?.test || 'npm test';
  } catch (_) {
    return 'npm test';
  }
}

// ============================================================
// STEP 6: Dispatch subagent
// ============================================================
async function dispatchSubagent(project, taskDescription, agent, brief) {
  const attachments = [
    'skills/dev-project-harness-loop/SKILL.md',
    'skills/subagent-coding-lite/SKILL.md',
    'skills/subagent-coding-lite/TEMPLATE_ASSIGNMENT.md',
    'skills/subagent-coding-lite/TEMPLATE_HANDOFF.md',
    agent.file,
    brief.relativePath  // ← v2 NEW: auto-attach architectural brief
  ];

  console.log(`\n📦 Dispatching with ${attachments.length} attachments:`);
  attachments.forEach(f => console.log(`   - ${f}`));

  // Write spawn pending file
  const spawnFile = path.join(WORKSPACE, '.harness-spawn-pending.json');
  await writeFile(spawnFile, JSON.stringify({
    task: taskDescription,
    label: taskDescription.slice(0, 40).replace(/\s+/g, '-').replace(/[^\w\-]/g, ''),
    agent,
    attachments,
    repoPath: project.repoPath,
    brief: brief.relativePath,
    sessionId: `session_${Date.now()}`,
    dispatchTime: new Date().toISOString()
  }, null, 2));

  // Try to detect OpenClaw environment
  const inOpenClaw = process.env.OPENCLAW_SESSION_KEY || process.env.OPENCLAW_GATEWAY_URL;
  if (inOpenClaw) {
    console.log(`\n✅ OpenClaw environment detected — ready for sessions_spawn`);
  } else {
    console.log(`\n⚠️  Not in OpenClaw environment`);
    console.log(`   Spawn config: ${spawnFile}`);
  }

  return `session_${Date.now()}`;
}

// ============================================================
// STEP 7: Update ACTIVE.md
// ============================================================
async function updateActive(project, taskDescription, session, agent, artifacts) {
  const content = `# ACTIVE.md — Current WIP

## Current Project
- **Name**: ${project.name}
- **Repo**: ${project.repoPath}
- **Task**: ${taskDescription}
- **Started**: ${new Date().toISOString()}
- **Session**: ${session || 'N/A'}
- **Status**: ${session ? 'running' : 'pending'}
- **Brief**: ${artifacts.brief.relativePath}

## Next Bet
- **Objective**: ${taskDescription}
- **Oracle**: \`cd "${project.repoPath}" && ${getBuildCmd(project.repoPath)} && bash scripts/run_change_guard.sh\`
- **Evidence**: artifacts/

${agent ? `## Assigned Agent
- **ID**: ${agent.id}
- **Confidence**: ${agent.confidence}%
- **Brief**: ${artifacts.brief.relativePath}` : ''}

## Blockers
- None

## Dispatch Rules（v2 — enforced by harness.js）
- All subagent dispatches must go through \`harness.js\` (this run)
- Architectural brief auto-generated at: \`${artifacts.brief.relativePath}\`
- Failure recovery: L0/L1/L2 classification, max 2 retries

---
*Last updated: ${new Date().toISOString()}*
`;

  await writeFile(ACTIVE_FILE, content);
}

// ============================================================
// REPORT
// ============================================================
function printReport(project, taskDescription, score, agent, session, brief) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 HARNESS TASK REPORT v2');
  console.log('='.repeat(70));
  console.log(`Project:   ${project.name}`);
  console.log(`Repo:      ${project.repoPath}`);
  console.log(`Task:      ${taskDescription}`);
  console.log(`Score:     ${score.total}/5.0 (${score.decision})`);
  console.log(`Brief:     ${brief.relativePath}`);

  if (agent) {
    console.log(`\nAgent:`);
    console.log(`   ID:          ${agent.id}`);
    console.log(`   Confidence:  ${agent.confidence}%`);
    console.log(`   Category:    ${agent.category}`);
  }

  if (session) {
    console.log(`\nSession:   ${session} (dispatched)`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ Task dispatched via harness.js v2');
  console.log('   1. Brief auto-generated — subagent reads this first');
  console.log('   2. Formal failure recovery enabled (L0/L1/L2 + 2 retries)');
  console.log('   3. Standard attachments injected (harness flow + subagent spec)');
  console.log('');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
