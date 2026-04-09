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

function detectFramework() {
  const pkg = safeRun('cat package.json');
  if (!pkg) return { framework: 'unknown', language: 'unknown' };
  try {
    const pj = JSON.parse(pkg);
    const deps = { ...(pj.dependencies || {}), ...(pj.devDependencies || {}) };
    const pkgJsonDeps = Object.keys(deps);
    // Ink is a React-based CLI renderer — distinct from web React
    if (pkgJsonDeps.includes('ink') && pkgJsonDeps.includes('react')) {
      return { framework: 'Node.js/Ink (CLI)', language: 'TypeScript' };
    }
    if (pkgJsonDeps.includes('next')) return { framework: 'Next.js', language: 'TypeScript' };
    if (pkgJsonDeps.includes('fastify')) return { framework: 'Fastify', language: 'TypeScript' };
    if (pkgJsonDeps.includes('express')) return { framework: 'Express', language: 'TypeScript' };
    if (pkgJsonDeps.includes('react') && !pkgJsonDeps.includes('ink')) return { framework: 'React (web)', language: 'JavaScript' };
    if (pkgJsonDeps.includes('vue')) return { framework: 'Vue', language: 'JavaScript' };
    if (pkgJsonDeps.includes('nestjs') || pkgJsonDeps.includes('@nestjs/common')) return { framework: 'NestJS', language: 'TypeScript' };
    if (pkgJsonDeps.includes('telegram-bot-api') || pkgJsonDeps.includes('node-telegram-bot-api')) return { framework: 'Node.js/Telegram Bot', language: 'TypeScript' };
    if (pj.require?.module === 'go') return { framework: 'Go', language: 'Go' };
    return { framework: 'Node.js', language: 'TypeScript' };
  } catch (_) {
    return { framework: 'unknown', language: 'unknown' };
  }
}

function getDirTree(depth = 3) {
  const raw = safeRun(`find . -type d -not -path './node_modules/*' -not -path './.git/*' -not -path './dist/*' -not -path './build/*' -not -path './__pycache__/*' -not -path './.next/*' -not -path './coverage/*' -not -path './dist_prod/*' 2>/dev/null`);
  const entries = raw.split('\n').filter(Boolean).map(f => {
    if (f.startsWith('/')) {
      const rel = path.relative(repoPath, f);
      return rel.startsWith('.') ? rel : './' + rel;
    }
    return f;
  });
  const dirs = entries;
  const maxDepth = Math.max(...dirs.map(d => d.split('/').length - 1));
  const displayDepth = Math.min(depth, maxDepth);
  
  // Build tree structure
  const tree = {};
  for (const dir of dirs) {
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

function getSrcFiles() {
  const output = safeRun(`find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.go" -o -name "*.py" \\) ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" ! -path "*/__pycache__/*" 2>/dev/null | head -2000`);
  return output.split('\n').filter(Boolean).map(f => {
    // normalize: resolve symlinks in the full path so path.relative works correctly
    if (f.startsWith('/')) {
      // f is an absolute path from find; resolve it through any symlinks
      const resolved = fs.realpathSync(f) || f;
      const rel = path.relative(repoPath, resolved);
      return rel.startsWith('./') ? rel : './' + rel;
    }
    return f.startsWith('./') ? f : './' + f;
  });
}

function extractImports(files) {
  const importMap = {}; // file → [imported modules]
  const moduleImports = {}; // imported module → [files that import it]
  const relMap = {}; // file → [local file imports]

  for (const file of files) {
    const relPath = file.replace(/^\.\//, '');
    try {
      const content = fs.readFileSync(path.join(repoPath, relPath), 'utf8');
      const localImports = [];
      const moduleImportList = [];

      // ES module imports: import x from '...' / import '...'
      const esMatches = content.matchAll(/import\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g);
      for (const m of esMatches) {
        const imp = m[1];
        if (imp.startsWith('.')) {
          localImports.push(imp);
        } else if (!imp.startsWith('@openclaw') && !imp.startsWith('openclaw')) {
          moduleImportList.push(imp.split('/')[0]);
        }
      }

      // CommonJS requires: require('...')
      const cjsMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
      for (const m of cjsMatches) {
        const imp = m[1];
        if (imp.startsWith('.')) {
          localImports.push(imp);
        } else {
          moduleImportList.push(imp.split('/')[0]);
        }
      }

      // Deduplicate
      const uniqLocal = [...new Set(localImports)];
      const uniqMod = [...new Set(moduleImportList)];

      if (uniqLocal.length > 0 || uniqMod.length > 0) {
        relMap[relPath] = uniqLocal;
      }
      for (const mod of uniqMod) {
        if (!moduleImports[mod]) moduleImports[mod] = [];
        moduleImports[mod].push(relPath);
      }
    } catch (_) {}
  }

  return { relMap, moduleImports };
}

function extractApiRoutes(files) {
  const routes = [];
  for (const file of files) {
    const relPath = file.replace(/^\.\//, '');
    if (relPath.includes('node_modules')) continue;
    try {
      const content = fs.readFileSync(path.join(repoPath, relPath), 'utf8');

      // Fastify route patterns: fastify.get|post|put|delete|patch(path, ...
      const fastifyMatches = content.matchAll(/(?:fastify|app|router)\.(get|post|put|delete|patch|head|options)\(['"]([^'"]+)['"]/gi);
      for (const m of fastifyMatches) {
        routes.push({ method: m[1].toUpperCase(), path: m[2], file: relPath });
      }

      // Express route patterns: app.get|post|router.get|post(path, ...
      const expressMatches = content.matchAll(/(?:app|router)\.(get|post|put|delete|patch|head|options)\(['"]([^'"]+)['"]/gi);
      for (const m of expressMatches) {
        routes.push({ method: m[1].toUpperCase(), path: m[2], file: relPath });
      }

      // Next.js API routes: pages/api/**/*.ts or app/api/**/*.ts
      if ((relPath.includes('pages/api') || relPath.includes('app/api')) && (relPath.endsWith('.ts') || relPath.endsWith('.js') || relPath.endsWith('.tsx'))) {
        const nextPath = relPath
          .replace('pages/api/', '/')
          .replace('app/api/', '/')
          .replace(/\.(ts|js|tsx)$/, '')
          .replace(/\[([^\]]+)\]/g, ':$1');
        routes.push({ method: 'GET/POST/PUT/DELETE', path: nextPath, file: relPath });
      }

      // NestJS decorators: @Get|@Post|@Put|@Delete|@Patch('path')
      const nestMatches = content.matchAll(/@(Get|Post|Put|Delete|Patch|Head|Options)\(['"]([^'"]+)['"]/g);
      for (const m of nestMatches) {
        routes.push({ method: m[1].toUpperCase(), path: m[2], file: relPath });
      }

      // Go router: http.MethodFunc / chi / gorilla mux
      const goMatches = content.matchAll(/(?:http\.HandleFunc|router\.(?:Handle|Method))\(['"]([^'"]+)['"]/gi);
      for (const m of goMatches) {
        routes.push({ method: '?', path: m[1], file: relPath });
      }
    } catch (_) {}
  }
  return routes;
}

function extractModels(files) {
  const models = [];
  const modelFilePatterns = [
    /models?\//i, /schemas?\//i, /entities?\//i, /types?\//i,
    /\/db\//i, /\/data\//i, /\/domain\//i, /\/core\//i,
  ];

  for (const file of files) {
    const relPath = file.replace(/^\.\//, '');
    if (relPath.includes('node_modules')) continue;
    const isModelFile = modelFilePatterns.some(p => p.test(relPath));

    try {
      const content = fs.readFileSync(path.join(repoPath, relPath), 'utf8');

      // TypeScript interfaces and types
      const tsInterfaces = [...content.matchAll(/export\s+(?:interface|type)\s+(\w+)/g)];
      for (const m of tsInterfaces) {
        models.push({ name: m[1], kind: m[0].startsWith('interface') ? 'interface' : 'type', file: relPath });
      }

      // Go structs
      const goStructs = [...content.matchAll(/type\s+(\w+)\s+struct\s*\{/g)];
      for (const m of goStructs) {
        models.push({ name: m[1], kind: 'struct', file: relPath });
      }

      // Python dataclasses / pydantic
      const pyClasses = [...content.matchAll(/class\s+(\w+).*\(.*(?:Base|Model|Schema|Config)/g)];
      for (const m of pyClasses) {
        models.push({ name: m[1], kind: 'class', file: relPath });
      }

      // Zod schemas
      const zodSchemas = [...content.matchAll(/export\s+(?:const|let)\s+(\w+)\s*=\s*(?:z\.object|z\.create)/g)];
      for (const m of zodSchemas) {
        models.push({ name: m[1], kind: 'zod schema', file: relPath });
      }
    } catch (_) {}
  }

  // Also flag model-like files even if no specific types found
  for (const file of files) {
    const relPath = file.replace(/^\.\//, '');
    if (modelFilePatterns.some(p => p.test(relPath)) && !models.some(m => m.file === relPath)) {
      models.push({ name: path.basename(relPath, path.extname(relPath)), kind: 'file (review)', file: relPath });
    }
  }

  return models;
}

function extractEntryPoints(files) {
  const entries = [];
  for (const file of files) {
    const relPath = file.replace(/^\.\//, '');
    if (relPath.includes('node_modules')) continue;
    try {
      const content = fs.readFileSync(path.join(repoPath, relPath), 'utf8');

      // package.json main / exports
      if (relPath === 'package.json') {
        const pj = JSON.parse(content);
        if (pj.main) entries.push({ name: 'main', path: pj.main, purpose: 'Application entry' });
        if (pj.exports) entries.push({ name: 'exports', path: '(see exports field)', purpose: 'Package exports' });
        if (pj.bin) entries.push({ name: 'bin', path: pj.bin, purpose: 'CLI bin entry' });
      }

      // Common entry point patterns
      const entryPatterns = ['index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js', 'server.ts', 'server.js', 'cli.ts', 'cli.js'];
      if (entryPatterns.includes(path.basename(relPath))) {
        entries.push({ name: path.basename(relPath), path: relPath, purpose: 'Likely entry point' });
      }

      // "use server" / "use client" directives (Next.js)
      if (content.includes("'use server'") || content.includes('"use server"')) {
        entries.push({ name: path.basename(relPath), path: relPath, purpose: 'Server Component' });
      }
    } catch (_) {}
  }
  return entries;
}

function extractCrossRefs(files, importRelMap) {
  // Map each file (without ./) to its group
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
      const abs = path.join(repoPath, path.dirname(file), imp);
      let absResolved;
      try { absResolved = fs.realpathSync(abs); } catch (_) { absResolved = abs; }
      const rel = path.relative(repoPath, absResolved);
      const grpB = rel.split('/').slice(0, GROUP_DEPTH).join('/');
      if (grpB !== grpA && groups.includes(grpB)) {
        const key = grpA + ' \u2192 ' + grpB;
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
  // ── Cache check ─────────────────────────────────────────────────────
  const FORCE = process.argv.includes('--force');
  const META_FILE = OUT.replace(/\.md$/, '.meta.json');

  const isGitRepo = safeRun('git rev-parse --is-inside-work-tree 2>/dev/null') === 'true';
  const trackedSrcCount = isGitRepo
    ? parseInt(safeRun(`git ls-files | grep -vcx -e 'codemap.md' -e 'harness/' 2>/dev/null`) || '0')
    : 0;

  if (!FORCE && fs.existsSync(OUT) && fs.existsSync(META_FILE)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
      const currentCommit = safeRun('git rev-parse HEAD 2>/dev/null') || 'unknown';
      // Rebuild on: modified tracked source files OR new untracked source files (excluding harness output)
      const dirtyTrackedSrc = isGitRepo
        ? safeRun("git diff --name-only 2>/dev/null | grep -cE '\\.(ts|tsx|js|jsx|go|py)$'").trim()
        : '0';
      // Ignore codemap's own script / output files (always untracked in this workflow)
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
        console.log(`   Run with --force to regenerate.`);
        return;
      }
    } catch (_) { /* meta corrupt or unreadable, regenerate */ }
  }
  // ────────────────────────────────────────────────────────────────────

  console.log(`\n📍 Building CodeMap for: ${repoPath}\n`);

  const frameworkInfo = detectFramework();
  const files = getSrcFiles();
  const { relMap, moduleImports } = extractImports(files);
  const routes = extractApiRoutes(files);
  const models = extractModels(files);
  const entries = extractEntryPoints(files);
  const xrefs = extractCrossRefs(files, relMap);
  const dirTree = getDirTree(3);

  // External dependencies (top-level, deduplicated)
  const NODE_BUILTINS = new Set(['fs', 'path', 'os', 'stream', 'buffer', 'util', 'crypto', 'events', 'net', 'http', 'https', 'url', 'querystring', 'child_process', 'readline', 'zlib', 'assert', 'tty', 'domain', 'http2', 'perf_hooks', 'trace_events', 'v8', 'vm', 'wasi', 'natives', 'module', 'constants', 'sys', 'timers', 'dns', 'dgram', 'string_decoder', 'async_hooks', 'diagnostics_channel', 'worker_threads', 'shared_buffers', 'test', 'node-inspect', 'assert/strict', 'fs/promises', 'path/posix', 'path/win32', 'stream/promises', 'stream/consumers', 'stream/web', 'util/types']);
  const INTERNAL_DIRS = new Set(['src', 'lib', 'app', 'models', 'services', 'routes', 'controllers', 'middleware', 'types', 'generated', 'dist', 'build', 'scripts', 'config', 'configs', 'utils', 'helpers']);
  const extDeps = [...new Set(Object.keys(moduleImports))].filter(dep =>
    !NODE_BUILTINS.has(dep) && !INTERNAL_DIRS.has(dep) && !dep.startsWith('.')
  ).sort();

  // Git info
  const gitBranch = safeRun('git rev-parse --abbrev-ref HEAD 2>/dev/null') || 'unknown';
  const gitLog = safeRun("git log --oneline -10 2>/dev/null") || 'no git history';
  const lastCommit = safeRun('git log -1 --format="%ai %s" 2>/dev/null') || 'unknown';

  // Build markdown
  const lines = [];
  lines.push(`# CodeMap — 项目结构索引`);
  lines.push('');
  lines.push(`> Auto-generated by codemap.js | ${new Date().toISOString()} | Framework: **${frameworkInfo.framework}** | Language: **${frameworkInfo.language}**`);
  lines.push('');
  lines.push(`## 基础信息`);
  lines.push('');
  lines.push(`| 项目 | 值 |`);
  lines.push(`|------|-----|`);
  lines.push(`| 仓库路径 | \`${repoPath}\` |`);
  lines.push(`| Git 分支 | \`${gitBranch}\` |`);
  lines.push(`| 最近提交 | ${lastCommit} |`);
  lines.push(`| 源码文件数 | ${files.length} |`);
  lines.push(`| 框架 | ${frameworkInfo.framework} |`);
  lines.push(`| 语言 | ${frameworkInfo.language} |`);
  lines.push('');

  lines.push(`## 目录结构（Depth ≤ 3）`);
  lines.push('');
  lines.push(`\`\`\``);
  lines.push(`.`);
  lines.push(dirTree);
  lines.push(`\`\`\``);
  lines.push('');

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
    lines.push(`## 跨目录引用（Top-level）`);
    lines.push('');
    lines.push(`| Cross-reference |`);
    lines.push(`|------------------|`);
    for (const x of xrefs) {
      lines.push(`| ${x} |`);
    }
    lines.push('');
  }

  if (extDeps.length > 0) {
    lines.push(`## 外部依赖（Top-level packages）`);
    lines.push('');
    lines.push(`\`\`\`json`);
    lines.push(JSON.stringify(extDeps, null, 2));
    lines.push(`\`\`\``);
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
  lines.push('');

  const content = lines.join('\n');

  // Ensure output directory exists
  const outDir = path.dirname(OUT);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(OUT, content, 'utf8');

  // Write cache metadata
  const currentCommit = safeRun('git rev-parse HEAD 2>/dev/null') || 'unknown';
  const meta = { commit: currentCommit, generatedAt: Date.now(), version: 1, trackedSrcCount };
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf8');

  console.log(`✅ CodeMap written to: ${OUT}`);
  console.log(`   Files scanned: ${files.length}`);
  console.log(`   Routes found: ${routes.length}`);
  console.log(`   Models found: ${models.length}`);
  console.log(`   External deps: ${extDeps.length}`);
  console.log(`   Cross-refs: ${xrefs.length}`);
}

buildCodemap().catch(err => {
  console.error('❌ codemap.js failed:', err.message);
  process.exit(1);
});
