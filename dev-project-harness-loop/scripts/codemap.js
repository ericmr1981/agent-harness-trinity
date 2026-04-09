#!/usr/bin/env node
/**
 * codemap.js — Build a project CodeMap artifact for Trinity harness
 *
 * Phase 1.5: Pre-Research structural indexing
 * Run after scanRepo, before task analysis.
 *
 * Output: harness/artifacts/codemap.md
 *
 * Usage:
 *   node codemap.js /path/to/repo [--output /path/to/output.md]
 *   node codemap.js /path/to/repo --force
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoPath = process.argv[2] || process.cwd();
const outputArg = process.argv.find((a, i) => process.argv[i - 1] === '--output');
const outputPath = outputArg ? process.argv[process.argv.indexOf(outputArg) + 1] : null;

const OUT = outputPath || path.join(repoPath, 'harness', 'artifacts', 'codemap.md');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      timeout: 15000,
      cwd: repoPath,
      ...opts,
    }).trim();
  } catch (e) {
    return '';
  }
}

function safeRun(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 10000, cwd: repoPath }).trim();
  } catch (_) {
    return '';
  }
}

/**
 * Strip comments from JS/TS/Go source so that regex patterns
 * don't fire on comment examples (e.g. "patch(" in a comment
 * should not be detected as a route).
 */
function stripComments(content, ext) {
  if (ext === '.py') {
    // Remove triple-quoted docstrings first
    content = content.replace(/'''[\s\S]*?'''/g, '');
    content = content.replace(/"""[\s\S]*?"""/g, '');
    // Remove # line comments
    content = content.replace(/#.*$/gm, '');
  } else {
    // Remove block comments (/* ... */) — handles multi-line
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove // line comments
    content = content.replace(/\/\/.*$/gm, '');
  }
  return content;
}

/**
 * Check if content has a real "use server" directive.
 * Only true when the directive appears as a bare string literal
 * on its own line at the top of the file — not inside comments.
 */
function isRealUseServerDirective(content) {
  // Take first non-empty line after stripping block comments
  const stripped = stripComments(content, '.js');
  const lines = stripped.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    // A bare 'use server' or "use server" on its own line
    if (/^['"]use server['"]\s*[;,]?\s*$/.test(trimmed)) return true;
    // Skip shebang, import/export, declare, or anything else
    if (!/^['"]use server['"]$/.test(trimmed)) break;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// Repo profile detection
// ─────────────────────────────────────────────────────────────
function detectRepoProfile() {
  const hasSkillMd = fs.existsSync(path.join(repoPath, 'SKILL.md'));
  const hasAgentsMd = fs.existsSync(path.join(repoPath, 'AGENTS.md'));
  const hasHarnessDir = fs.existsSync(path.join(repoPath, 'harness'));
  const hasSubagentLite = fs.existsSync(path.join(repoPath, 'subagent-coding-lite'));
  const hasPackageJson = fs.existsSync(path.join(repoPath, 'package.json'));
  const hasReadme = fs.existsSync(path.join(repoPath, 'README.md'));
  const hasMapMd = fs.existsSync(path.join(repoPath, 'MAP.md'));

  const isSkillOrHarness = hasSkillMd || (hasHarnessDir && hasAgentsMd);
  const isOpenClawAgent = hasSkillMd && hasAgentsMd;
  const isMultiAgentTeam = hasSubagentLite || hasHarnessDir;

  let profile = 'generic';
  if (isOpenClawAgent) profile = 'OpenClaw agent workspace';
  else if (isMultiAgentTeam) profile = 'multi-agent harness';
  else if (isSkillOrHarness) profile = 'skill / harness module';
  else if (hasReadme || hasMapMd) profile = 'documentation / knowledge base';
  else if (hasPackageJson) profile = 'Node.js application';
  else profile = 'unclassified';

  return { profile, isSkillOrHarness };
}

// ─────────────────────────────────────────────────────────────
// Framework detection (app repos)
// ─────────────────────────────────────────────────────────────
function detectFramework() {
  const pkg = safeRun('cat package.json');
  if (!pkg) return { framework: 'unknown', language: 'unknown', profile: 'non-app repo' };
  try {
    const pj = JSON.parse(pkg);
    const deps = { ...(pj.dependencies || {}), ...(pj.devDependencies || {}) };
    const pkgJsonDeps = Object.keys(deps);
    if (pkgJsonDeps.includes('ink') && pkgJsonDeps.includes('react')) {
      return { framework: 'Node.js/Ink (CLI)', language: 'TypeScript', profile: 'app' };
    }
    if (pkgJsonDeps.includes('next')) return { framework: 'Next.js', language: 'TypeScript', profile: 'app' };
    if (pkgJsonDeps.includes('fastify')) return { framework: 'Fastify', language: 'TypeScript', profile: 'app' };
    if (pkgJsonDeps.includes('express')) return { framework: 'Express', language: 'TypeScript', profile: 'app' };
    if (pkgJsonDeps.includes('react') && !pkgJsonDeps.includes('ink')) {
      return { framework: 'React (web)', language: 'JavaScript', profile: 'app' };
    }
    if (pkgJsonDeps.includes('vue')) return { framework: 'Vue', language: 'JavaScript', profile: 'app' };
    if (pkgJsonDeps.includes('nestjs') || pkgJsonDeps.includes('@nestjs/common')) {
      return { framework: 'NestJS', language: 'TypeScript', profile: 'app' };
    }
    if (pkgJsonDeps.includes('telegram-bot-api') || pkgJsonDeps.includes('node-telegram-bot-api')) {
      return { framework: 'Node.js/Telegram Bot', language: 'TypeScript', profile: 'app' };
    }
    if (pj.require?.module === 'go') return { framework: 'Go', language: 'Go', profile: 'app' };
    return { framework: 'Node.js', language: 'TypeScript', profile: 'app' };
  } catch (_) {
    return { framework: 'unknown', language: 'unknown', profile: 'app' };
  }
}

// ─────────────────────────────────────────────────────────────
// Directory tree
// ─────────────────────────────────────────────────────────────
function getDirTree(depth = 3) {
  const raw = safeRun(
    `find . -type d -not -path './node_modules/*' -not -path './.git/*' ` +
    `-not -path './dist/*' -not -path './build/*' -not -path './__pycache__/*' ` +
    `-not -path './.next/*' -not -path './coverage/*' -not -path './dist_prod/*' ` +
    `2>/dev/null`
  );
  const entries = raw.split('\n').filter(Boolean).map(f => {
    if (f.startsWith('/')) {
      const rel = path.relative(repoPath, f);
      return rel.startsWith('.') ? rel : './' + rel;
    }
    return f;
  });
  const maxDepth = Math.max(...entries.map(d => d.split('/').length - 1), 0);
  const displayDepth = Math.min(depth, maxDepth);

  const tree = {};
  for (const dir of entries) {
    const parts = dir.replace(/^\.\//, '').split('/');
    let node = tree;
    for (let i = 0; i < parts.length && i < displayDepth; i++) {
      if (!node[parts[i]]) node[parts[i]] = {};
      node = node[parts[i]];
    }
  }

  function printTree(obj, prefix = '', depth = 0) {
    const keys = Object.keys(obj).sort();
    const lines = [];
    keys.forEach((key, i) => {
      const isLast = i === keys.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      lines.push(`${prefix}${connector}${key}/`);
      if (depth < displayDepth) {
        lines.push(...printTree(obj[key], prefix + (isLast ? '    ' : '│   '), depth + 1));
      }
    });
    return lines;
  }

  return printTree(tree).join('\n');
}

// ─────────────────────────────────────────────────────────────
// Source file discovery
// ─────────────────────────────────────────────────────────────
function getSrcFiles() {
  const output = safeRun(
    `find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.go" -o -name "*.py" \\) ` +
    `! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" ! -path "*/__pycache__/*" ` +
    `2>/dev/null | head -2000`
  );
  return output.split('\n').filter(Boolean).map(f => {
    if (f.startsWith('/')) {
      const resolved = fs.realpathSync(f) || f;
      const rel = path.relative(repoPath, resolved);
      return rel.startsWith('./') ? rel : './' + rel;
    }
    return f.startsWith('./') ? f : './' + f;
  });
}

/**
 * Scan for key non-code files (markdown, shell, yaml, json configs).
 * Returns an array of { path, type, purpose } entries.
 */
function getNonCodeFiles() {
  const keyPatterns = [
    // Root-level project docs
    { pattern: 'README.md', type: 'md', purpose: '项目说明' },
    { pattern: 'AGENTS.md', type: 'md', purpose: 'Agent 工作区定义' },
    { pattern: 'CLAUDE.md', type: 'md', purpose: '项目使命宪章' },
    { pattern: 'MAP.md', type: 'md', purpose: '文件关系图' },
    { pattern: 'CHANGELOG.md', type: 'md', purpose: '变更日志' },
    { pattern: 'features.json', type: 'json', purpose: 'Feature 检查清单' },
    { pattern: 'harness.json', type: 'json', purpose: 'Harness 配置' },
    { pattern: 'package.json', type: 'json', purpose: 'npm / Node.js 配置' },
    { pattern: '.gitignore', type: 'config', purpose: 'Git 忽略规则' },
    // Skill / harness specific
    { pattern: 'SKILL.md', type: 'md', purpose: 'Skill 定义' },
    { pattern: 'init.sh', type: 'sh', purpose: '初始化脚本' },
    { pattern: 'tests/smoke.sh', type: 'sh', purpose: '冒烟测试' },
    // Directory-level configs
    { pattern: 'harness/goal.md', type: 'md', purpose: 'Goal 合同' },
    { pattern: 'harness/handoff.md', type: 'md', purpose: 'Handoff 文档' },
    { pattern: '.github/workflows/ci.yml', type: 'yml', purpose: 'CI 工作流' },
    { pattern: 'HARNESS_LINKS.md', type: 'md', purpose: 'Harness 链接映射' },
  ];

  const found = [];
  for (const { pattern, type, purpose } of keyPatterns) {
    if (fs.existsSync(path.join(repoPath, pattern))) {
      found.push({ path: pattern, type, purpose });
    }
  }
  return found;
}

function topGroupForPath(relPath, depth = 2) {
  const normalized = relPath.replace(/^\.\//, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return '(root)';
  if (parts.length === 1) return parts[0];
  return parts.slice(0, Math.min(depth, parts.length)).join('/');
}

function classifyArtifact(relPath) {
  const p = relPath.replace(/^\.\//, '');
  const base = path.basename(p);

  if (/^harness\/(artifacts|reports|context|qa)\//.test(p) || ['ACTIVE.md', 'CHANGELOG.md', 'features.json', 'HARNESS_LINKS.md'].includes(p)) {
    return '记录 / 状态层';
  }
  if (/^harness\/contracts\//.test(p) || /^.*TEMPLATE_.*\.md$/.test(base) || /template/i.test(base) || ['harness/goal.md', 'harness/handoff.md', 'harness.json'].includes(p)) {
    return '合同 / 模板层';
  }
  if (/^tests\//.test(p) || /^.*run_.*guard\.sh$/.test(base) || base === 'smoke.sh' || /rubrics\//.test(p)) {
    return '验证 / 守卫层';
  }
  if (/^.*\/scripts\//.test(p) || /^scripts\//.test(p) || base === 'init.sh') {
    return '执行 / 编排层';
  }
  if (base === 'SKILL.md' || /\/SKILL\.md$/.test(p) || /^skills\//.test(p) || /^kickoff\//.test(p) || /^harness\//.test(p) && base === 'SKILL.md') {
    return '技能 / 入口层';
  }
  if (/^docs\//.test(p) || /^.*\/references\//.test(p) || ['README.md', 'MAP.md', 'AGENTS.md', 'CLAUDE.md'].includes(p)) {
    return '文档 / 导航层';
  }
  if (/\.(ts|tsx|js|jsx|go|py)$/.test(p)) {
    return '源码 / 逻辑层';
  }
  return '其他';
}

function buildRoleMap(files, nonCodeFiles) {
  const buckets = new Map();
  const allPaths = [
    ...files.map(f => f.replace(/^\.\//, '')),
    ...nonCodeFiles.map(f => f.path),
  ];

  for (const relPath of allPaths) {
    const layer = classifyArtifact(relPath);
    if (!buckets.has(layer)) buckets.set(layer, []);
    buckets.get(layer).push(relPath);
  }

  return [...buckets.entries()].map(([layer, items]) => ({
    layer,
    count: items.length,
    examples: items.sort().slice(0, 5),
  }));
}

function extractDocCrossRefs(files, nonCodeFiles) {
  const textFiles = [
    ...nonCodeFiles.map(f => f.path),
    ...files.map(f => f.replace(/^\.\//, '')).filter(p => /\.(sh|md|json|ya?ml)$/.test(p)),
  ];
  const candidatePaths = [...new Set([
    ...files.map(f => f.replace(/^\.\//, '')),
    ...nonCodeFiles.map(f => f.path),
  ])].sort((a, b) => b.length - a.length);

  const edges = [];
  const seen = new Set();

  for (const src of [...new Set(textFiles)]) {
    const abs = path.join(repoPath, src);
    if (!fs.existsSync(abs)) continue;
    let content = '';
    try {
      content = fs.readFileSync(abs, 'utf8');
    } catch (_) {
      continue;
    }

    const srcGroup = topGroupForPath(src);
    for (const target of candidatePaths) {
      if (target === src) continue;
      if (!content.includes(target)) continue;
      const dstGroup = topGroupForPath(target);
      if (srcGroup === dstGroup) continue;
      const key = `${srcGroup} → ${dstGroup}`;
      if (seen.has(`${src}::${target}`)) continue;
      seen.add(`${src}::${target}`);
      edges.push({ source: srcGroup, target: dstGroup, via: src, path: target, key });
    }
  }

  const grouped = new Map();
  for (const edge of edges) {
    if (!grouped.has(edge.key)) grouped.set(edge.key, { source: edge.source, target: edge.target, via: new Set(), paths: new Set() });
    grouped.get(edge.key).via.add(edge.via);
    grouped.get(edge.key).paths.add(edge.path);
  }

  return [...grouped.values()].map(item => ({
    source: item.source,
    target: item.target,
    via: [...item.via].slice(0, 2),
    paths: [...item.paths].slice(0, 3),
  })).slice(0, 30);
}

// ─────────────────────────────────────────────────────────────
// Import extraction
// ─────────────────────────────────────────────────────────────
function extractImports(files) {
  const relMap = {};
  const moduleImports = {};

  for (const file of files) {
    const relPath = file.replace(/^\.\//, '');
    try {
      const content = fs.readFileSync(path.join(repoPath, relPath), 'utf8');
      const localImports = [];
      const moduleImportList = [];

      const esMatches = content.matchAll(/import\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g);
      for (const m of esMatches) {
        const imp = m[1];
        if (imp.startsWith('.')) {
          localImports.push(imp);
        } else if (!imp.startsWith('@openclaw') && !imp.startsWith('openclaw')) {
          moduleImportList.push(imp.split('/')[0]);
        }
      }

      const cjsMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
      for (const m of cjsMatches) {
        const imp = m[1];
        if (imp.startsWith('.')) {
          localImports.push(imp);
        } else {
          moduleImportList.push(imp.split('/')[0]);
        }
      }

      if (localImports.length > 0 || moduleImportList.length > 0) {
        relMap[relPath] = localImports;
      }
      for (const mod of [...new Set(moduleImportList)]) {
        if (!moduleImports[mod]) moduleImports[mod] = [];
        moduleImports[mod].push(relPath);
      }
    } catch (_) {}
  }

  return { relMap, moduleImports };
}

// ─────────────────────────────────────────────────────────────
// API route extraction (false-positive resistant)
// ─────────────────────────────────────────────────────────────
function extractApiRoutes(files) {
  const routes = [];

  for (const file of files) {
    const relPath = file.replace(/^\.\//, '');
    if (relPath.includes('node_modules')) continue;

    // Skip files whose basename is the codemap script itself
    // (the word "patch" appears in a comment inside codemap.js — don't pick it up)
    const basename = path.basename(relPath);
    if (basename === 'codemap.js' || basename === 'codemap.ts') continue;

    const ext = path.extname(relPath);
    try {
      const content = fs.readFileSync(path.join(repoPath, relPath), 'utf8');
      // Use stripped content so comment examples don't fire false positives
      const sc = stripComments(content, ext);

      // Fastify / Express — require that the first token before the dot
      // is a known variable name (not a comment artifact)
      const httpMatches = [...sc.matchAll(/(?:fastify|app|router)\.(get|post|put|delete|patch|head|options)\(['"]([^'"]+)['"]/gi)];
      for (const m of httpMatches) {
        // Filter out obvious path strings that aren't HTTP routes
        const routePath = m[2];
        if (/^['"]\/|^['"]\w+(\/\w+)*['"]$/.test(routePath) && routePath.length < 200) {
          routes.push({ method: m[1].toUpperCase(), path: routePath, file: relPath });
        }
      }

      // NestJS decorators
      const nestMatches = [...sc.matchAll(/@(Get|Post|Put|Delete|Patch|Head|Options)\(['"]([^'"]+)['"]/g)];
      for (const m of nestMatches) {
        routes.push({ method: m[1].toUpperCase(), path: m[2], file: relPath });
      }

      // Next.js API routes
      if ((relPath.includes('pages/api') || relPath.includes('app/api')) &&
          (ext === '.ts' || ext === '.js' || ext === '.tsx')) {
        const nextPath = relPath
          .replace('pages/api/', '/')
          .replace('app/api/', '/')
          .replace(/\.(ts|js|tsx)$/, '')
          .replace(/\[([^\]]+)\]/g, ':$1');
        routes.push({ method: 'GET/POST/PUT/DELETE', path: nextPath, file: relPath });
      }
    } catch (_) {}
  }

  return routes;
}

// ─────────────────────────────────────────────────────────────
// Model / type extraction
// ─────────────────────────────────────────────────────────────
function extractModels(files) {
  const models = [];
  const modelFilePatterns = [
    /models?\//i, /schemas?\//i, /entities?\//i, /types?\//i,
    /\/db\//i, /\/data\//i, /\/domain\//i, /\/core\//i,
  ];

  for (const file of files) {
    const relPath = file.replace(/^\.\//, '');
    if (relPath.includes('node_modules')) continue;

    try {
      const content = fs.readFileSync(path.join(repoPath, relPath), 'utf8');
      const tsInterfaces = [...content.matchAll(/export\s+(?:interface|type)\s+(\w+)/g)];
      for (const m of tsInterfaces) {
        models.push({ name: m[1], kind: m[0].startsWith('interface') ? 'interface' : 'type', file: relPath });
      }
      const goStructs = [...content.matchAll(/type\s+(\w+)\s+struct\s*\{/g)];
      for (const m of goStructs) {
        models.push({ name: m[1], kind: 'struct', file: relPath });
      }
      const pyClasses = [...content.matchAll(/class\s+(\w+).*\(.*(?:Base|Model|Schema|Config)/g)];
      for (const m of pyClasses) {
        models.push({ name: m[1], kind: 'class', file: relPath });
      }
      const zodSchemas = [...content.matchAll(/export\s+(?:const|let)\s+(\w+)\s*=\s*(?:z\.object|z\.create)/g)];
      for (const m of zodSchemas) {
        models.push({ name: m[1], kind: 'zod schema', file: relPath });
      }
    } catch (_) {}
  }

  // Also flag model-like files even if no types found
  for (const file of files) {
    const relPath = file.replace(/^\.\//, '');
    if (modelFilePatterns.some(p => p.test(relPath)) && !models.some(m => m.file === relPath)) {
      models.push({ name: path.basename(relPath, path.extname(relPath)), kind: 'file (review)', file: relPath });
    }
  }

  return models;
}

// ─────────────────────────────────────────────────────────────
// Entry point extraction
// ─────────────────────────────────────────────────────────────
function extractEntryPoints(files) {
  const entries = [];

  for (const file of files) {
    const relPath = file.replace(/^\.\//, '');
    if (relPath.includes('node_modules')) continue;

    try {
      const content = fs.readFileSync(path.join(repoPath, relPath), 'utf8');
      const basename = path.basename(relPath);

      // package.json — main / exports / bin
      if (basename === 'package.json') {
        try {
          const pj = JSON.parse(content);
          if (pj.main) entries.push({ name: 'main', path: relPath, purpose: 'Application entry' });
          if (pj.exports) entries.push({ name: 'exports', path: relPath, purpose: 'Package exports' });
          if (pj.bin) entries.push({ name: 'bin', path: relPath, purpose: 'CLI bin entry' });
        } catch (_) {}
      }

      // Common CLI / server entry point names
      const entryPatterns = ['main.ts', 'main.js', 'app.ts', 'app.js', 'server.ts', 'server.js', 'cli.ts', 'cli.js', 'index.ts', 'index.js'];
      if (entryPatterns.includes(basename)) {
        entries.push({ name: basename, path: relPath, purpose: 'Likely entry point' });
      }

      // Real "use server" directive (not from comments)
      if (basename.endsWith('.js') || basename.endsWith('.ts') || basename.endsWith('.tsx')) {
        if (isRealUseServerDirective(content)) {
          entries.push({ name: basename, path: relPath, purpose: 'Next.js Server Component' });
        }
      }
    } catch (_) {}
  }

  return entries;
}

// ─────────────────────────────────────────────────────────────
// Cross-reference extraction
// ─────────────────────────────────────────────────────────────
function extractCrossRefs(files, importRelMap) {
  const GROUP_DEPTH = 2;
  const SKIP_TOP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', '.next']);
  const fileToGroup = {};

  for (const file of files) {
    const rp = file.replace(/^\.\//, '');
    const parts = rp.split('/');
    if (parts.length < GROUP_DEPTH) continue;
    if (SKIP_TOP.has(parts[0])) continue;
    const grp = parts.slice(0, GROUP_DEPTH).join('/');
    if (grp.includes('.')) continue;
    fileToGroup[rp] = grp;
  }

  const groups = [...new Set(Object.values(fileToGroup))].sort();
  const xrefs = [];
  const seen = new Set();

  for (const [file, locals] of Object.entries(importRelMap)) {
    const grpA = fileToGroup[file];
    if (!grpA) continue;
    for (const imp of locals) {
      let abs;
      try {
        abs = fs.realpathSync(path.join(repoPath, path.dirname(file), imp));
      } catch (_) {
        abs = path.join(repoPath, path.dirname(file), imp);
      }
      const rel = path.relative(repoPath, abs);
      const grpB = rel.split('/').slice(0, GROUP_DEPTH).join('/');
      if (grpB !== grpA && groups.includes(grpB)) {
        const key = `${grpA} → ${grpB}`;
        if (!seen.has(key)) { seen.add(key); xrefs.push(key); }
      }
    }
  }

  return xrefs.slice(0, 30);
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function buildCodemap() {
  const FORCE = process.argv.includes('--force');
  const META_FILE = OUT.replace(/\.md$/, '.meta.json');

  const isGitRepo = safeRun('git rev-parse --is-inside-work-tree 2>/dev/null') === 'true';
  const trackedSrcCount = isGitRepo
    ? parseInt(
        safeRun("git ls-files 2>/dev/null | grep -vE '^(harness/artifacts/|codemap\\.md$)' | grep -cE '\\.(ts|tsx|js|jsx|go|py)$'") || '0'
      )
    : 0;

  if (!FORCE && fs.existsSync(OUT) && fs.existsSync(META_FILE)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
      const currentCommit = isGitRepo ? safeRun('git rev-parse HEAD 2>/dev/null') || 'unknown' : 'unknown';
      const dirtyTrackedSrc = isGitRepo
        ? safeRun("git diff --name-only 2>/dev/null | grep -cE '\\.(ts|tsx|js|jsx|go|py)$'").trim()
        : '0';
      const newUntrackedSrc = isGitRepo
        ? safeRun("git ls-files --others --exclude-standard 2>/dev/null | grep -vE 'codemap|\\.meta\\.json$' | grep -cE '\\.(ts|tsx|js|jsx|go|py)$'").trim()
        : '0';
      const isDirty = isGitRepo && (
        (meta.trackedSrcCount != null && meta.trackedSrcCount !== trackedSrcCount) ||
        parseInt(dirtyTrackedSrc || '0') > 0 ||
        parseInt(newUntrackedSrc || '0') > 0
      );
      if (!isDirty && meta.commit === currentCommit) {
        const age = Date.now() - meta.generatedAt;
        const mins = Math.round(age / 60000);
        console.log(`⏭  CodeMap up-to-date (commit ${meta.commit?.substring(0, 7)}, ${mins}m ago) — skipping.`);
        console.log('   Run with --force to regenerate.');
        return;
      }
    } catch (_) { /* regenerate on parse error */ }
  }

  console.log(`\n📍 Building CodeMap for: ${repoPath}\n`);

  const { profile: repoProfile, isSkillOrHarness } = detectRepoProfile();
  const { framework, language } = detectFramework();
  const files = getSrcFiles();
  const { relMap, moduleImports } = extractImports(files);
  const routes = extractApiRoutes(files);
  const models = extractModels(files);
  const entries = extractEntryPoints(files);
  const xrefs = extractCrossRefs(files, relMap);
  const dirTree = getDirTree(3);
  const nonCodeFiles = getNonCodeFiles();
  const roleMap = buildRoleMap(files, nonCodeFiles);
  const docCrossRefs = extractDocCrossRefs(files, nonCodeFiles);

  const NODE_BUILTINS = new Set([
    'fs', 'path', 'os', 'stream', 'buffer', 'util', 'crypto', 'events', 'net', 'http', 'https',
    'url', 'querystring', 'child_process', 'readline', 'zlib', 'assert', 'tty', 'domain', 'http2',
    'perf_hooks', 'trace_events', 'v8', 'vm', 'wasi', 'natives', 'module', 'constants', 'sys',
    'timers', 'dns', 'dgram', 'string_decoder', 'async_hooks', 'diagnostics_channel', 'worker_threads',
    'shared_buffers', 'test', 'node-inspect', 'assert/strict', 'fs/promises', 'path/posix',
    'path/win32', 'stream/promises', 'stream/consumers', 'stream/web', 'util/types',
  ]);
  const INTERNAL_DIRS = new Set([
    'src', 'lib', 'app', 'models', 'services', 'routes', 'controllers', 'middleware',
    'types', 'generated', 'dist', 'build', 'scripts', 'config', 'configs', 'utils', 'helpers',
  ]);
  const extDeps = [...new Set(Object.keys(moduleImports))]
    .filter(dep => !NODE_BUILTINS.has(dep) && !INTERNAL_DIRS.has(dep) && !dep.startsWith('.'))
    .sort();

  const gitBranch = safeRun('git rev-parse --abbrev-ref HEAD 2>/dev/null') || 'unknown';
  const lastCommit = safeRun('git log -1 --format="%ai %s" 2>/dev/null') || 'unknown';

  const lines = [];
  lines.push(`# CodeMap — 项目结构索引`);
  lines.push('');
  lines.push(`> Auto-generated by codemap.js | ${new Date().toISOString()} | **${repoProfile}** | Framework: **${framework}** | Language: **${language}**`);
  lines.push('');
  lines.push(`## 基础信息`);
  lines.push('');
  lines.push(`| 项目 | 值 |`);
  lines.push(`|------|-----|`);
  lines.push(`| 仓库路径 | \`${repoPath}\` |`);
  lines.push(`| Git 分支 | \`${gitBranch}\` |`);
  lines.push(`| 最近提交 | ${lastCommit} |`);
  lines.push(`| 源码文件数 | ${files.length} |`);
  lines.push(`| 仓库画像 | ${repoProfile} |`);
  lines.push(`| 框架 | ${framework} |`);
  lines.push(`| 语言 | ${language} |`);
  lines.push('');

  lines.push(`## 目录结构（Depth ≤ 3）`);
  lines.push('');
  lines.push('```');
  lines.push('.');
  lines.push(dirTree);
  lines.push('```');
  lines.push('');

  // Key non-code files section — especially valuable for skill/harness repos
  if (nonCodeFiles.length > 0) {
    lines.push(`## 关键文件（含文档 / 配置）`);
    lines.push('');
    lines.push(`| 文件 | 类型 | 用途 |`);
    lines.push(`|------|------|------|`);
    for (const f of nonCodeFiles) {
      lines.push(`| \`${f.path}\` | ${f.type} | ${f.purpose} |`);
    }
    lines.push('');
  }

  if (roleMap.length > 0) {
    lines.push(`## 职责分层（Role Map）`);
    lines.push('');
    lines.push(`| 层级 | 数量 | 代表文件 |`);
    lines.push(`|------|------|----------|`);
    for (const item of roleMap) {
      lines.push(`| ${item.layer} | ${item.count} | ${item.examples.map(p => `\`${p}\``).join('<br>')} |`);
    }
    lines.push('');
  }

  if (entries.length > 0) {
    lines.push(`## 入口文件`);
    lines.push('');
    lines.push(`| 名称 | 路径 | 用途 |`);
    lines.push(`|------|------|------|`);
    for (const e of entries) {
      lines.push(`| ${e.name} | \`${e.path}\` | ${e.purpose} |`);
    }
    lines.push('');
  }

  if (routes.length > 0) {
    lines.push(`## API 路由表`);
    lines.push('');
    lines.push(`| Method | Path | File |`);
    lines.push(`|--------|------|------|`);
    for (const r of routes.slice(0, 50)) {
      lines.push(`| ${r.method} | \`${r.path}\` | \`${r.file}\` |`);
    }
    if (routes.length > 50) lines.push(`*...还有 ${routes.length - 50} 条路由*`);
    lines.push('');
  }

  if (models.length > 0) {
    lines.push(`## 数据模型 / 类型定义`);
    lines.push('');
    lines.push(`| Name | Kind | File |`);
    lines.push(`|------|------|------|`);
    for (const m of models.slice(0, 50)) {
      lines.push(`| ${m.name} | ${m.kind} | \`${m.file}\` |`);
    }
    if (models.length > 50) lines.push(`*...还有 ${models.length - 50} 条*`);
    lines.push('');
  }

  if (xrefs.length > 0) {
    lines.push(`## 跨目录引用（代码导入）`);
    lines.push('');
    lines.push(`| Cross-reference |`);
    lines.push(`|------------------|`);
    for (const x of xrefs) {
      lines.push(`| ${x} |`);
    }
    lines.push('');
  }

  if (docCrossRefs.length > 0) {
    lines.push(`## 跨目录引用（文档 / 脚本显式提及）`);
    lines.push('');
    lines.push(`| Source | Target | Via | Paths |`);
    lines.push(`|--------|--------|-----|-------|`);
    for (const ref of docCrossRefs) {
      lines.push(`| ${ref.source} | ${ref.target} | ${ref.via.map(v => `\`${v}\``).join('<br>')} | ${ref.paths.map(p => `\`${p}\``).join('<br>')} |`);
    }
    lines.push('');
  }

  if (extDeps.length > 0) {
    lines.push(`## 外部依赖（Top-level packages）`);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(extDeps, null, 2));
    lines.push('```');
    lines.push('');
  }

  lines.push(`## 源码文件清单（Top 30 by lines）`);
  lines.push('');
  lines.push(`| File | Lines |`);
  lines.push(`|------|-------|`);
  const fileLines = [];
  for (const f of files) {
    const relPath = f.replace(/^\.\//, '');
    try {
      const linesCount = execSync(`wc -l < "${path.join(repoPath, relPath)}"`, { encoding: 'utf8', timeout: 5000 }).trim();
      fileLines.push({ path: relPath, lines: parseInt(linesCount) || 0 });
    } catch (_) {
      fileLines.push({ path: relPath, lines: 0 });
    }
  }
  fileLines.sort((a, b) => b.lines - a.lines);
  for (const f of fileLines.slice(0, 30)) {
    lines.push(`| \`${f.path}\` | ${f.lines} |`);
  }
  lines.push('');

  lines.push(`## 使用建议`);
  lines.push('');
  lines.push(`- 修改前先查此文档，确认影响范围`);
  lines.push(`- 新增 API 先查路由表，避免冲突`);
  lines.push(`- 新增 model 先查数据模型，确认已有类型`);
  lines.push(`- Debug 时先看跨目录引用，定位传播路径`);
  lines.push(`- 先看职责分层，再决定是改执行层、合同层、记录层还是守卫层`);
  if (isSkillOrHarness) {
    lines.push(`- 本仓库为 **skill / harness** 类型，重点关注 \`SKILL.md\`、\`harness/\` 目录和关键配置文件`);
    lines.push(`- 改动脚本前，优先检查它是否被文档 / 模板 / guard 链路显式引用`);
  }
  lines.push('');

  const content = lines.join('\n');

  const outDir = path.dirname(OUT);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(OUT, content, 'utf8');

  const currentCommit = isGitRepo ? safeRun('git rev-parse HEAD 2>/dev/null') || 'unknown' : 'unknown';
  const meta = {
    commit: currentCommit,
    generatedAt: Date.now(),
    version: 3,
    trackedSrcCount,
    repoProfile,
    roleLayers: roleMap.length,
    docCrossRefs: docCrossRefs.length,
  };
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf8');

  console.log(`✅ CodeMap written to: ${OUT}`);
  console.log(`   Repo profile: ${repoProfile}`);
  console.log(`   Files scanned: ${files.length}`);
  console.log(`   Routes found: ${routes.length}`);
  console.log(`   Models found: ${models.length}`);
  console.log(`   External deps: ${extDeps.length}`);
  console.log(`   Cross-refs (code): ${xrefs.length}`);
  console.log(`   Cross-refs (doc/script): ${docCrossRefs.length}`);
  console.log(`   Role layers: ${roleMap.length}`);
  console.log(`   Non-code key files: ${nonCodeFiles.length}`);
}

buildCodemap().catch(err => {
  console.error('❌ codemap.js failed:', err.message);
  process.exit(1);
});
