# Progress Log

## 2026-04-09夜 — CodeMap 3.0 进行中：职责分层 + 文档/脚本跨目录引用
**status:** in progress (local verified, records syncing)

**已完成：**
- 在 `codemap.js` 上叠加 CodeMap 3.0 主能力：
  - `buildRoleMap()`：按 **技能/入口层、执行/编排层、合同/模板层、记录/状态层、验证/守卫层、文档/导航层** 分类仓库职责
  - `extractDocCrossRefs()`：扫描文档/脚本中对 repo 内路径的显式提及，生成“文档 / 脚本跨目录引用”关系
  - `topGroupForPath()` / `classifyArtifact()`：把路径映射成更稳定的结构分组和职责层级
- 本地强制生成验证结果：
  - `roleLayers: 7`
  - `docCrossRefs: 30`
  - 无 `PATCH /path` / 假 `Server Component` 回归
- 这意味着 CodeMap 已不只是目录页，而开始具备“作战地图”能力

**待完成：**
- 最终 guard / record 收尾
- 如 Boss 同意，再 commit + push

---

## 2026-04-09晚 — CodeMap 2.0 升级：消除假阳性 + 新增 skill/harness 仓库画像支持
**commit:** `dff2269` (HEAD)

**本轮完成：**
- 重写 `dev-project-harness-loop/scripts/codemap.js`（v2），消除三大误报：
  1. **API 路由误报**：新增 `stripComments()` 辅助函数，在正则提取路由之前先剥离 JS/TS/Go 代码注释；过滤掉 codemap 自身文件
  2. **"use server" 误报**：改为只在首行真实指令中匹配（不再是注释中的字符串）
  3. **路由字符串过滤**：增加了对路由路径格式的基本校验（长度 <200，前缀为 `/` 或合法 path）
- **新增 `detectRepoProfile()`**：自动识别 skill/harness 仓库（检出 `multi-agent harness`）并写入元数据
- **新增 `getNonCodeFiles()`**：扫描 14 类关键非源码文件（SKILL.md、AGENTS.md、harness/goal.md 等），对 skill/harness 仓库价值大幅提升
- **新增 `repoProfile` 写入 codemap.meta.json**（version: 2）
- `extractApiRoutes()` 和 `extractEntryPoints()` 均已改用清洗后的内容
- 使用建议部分加入 skill/harness 仓库的专属提示

**验证（均通过）：**
- `node --check dev-project-harness-loop/scripts/codemap.js` → 通过
- `node dev-project-harness-loop/scripts/codemap.js . --force --output harness/artifacts/codemap.md` → Routes found: 0（之前是 1 条误报），Repo profile: multi-agent harness，Non-code key files: 14
- `bash scripts/run_drift_check.sh` → 通过
- `bash scripts/run_trinity_guard.sh` → ✅ GUARD PASSED
- `bash init.sh` → 通过

---

## 2026-04-09 — 修正 codemap 统计漂移并同步仓库记录
**refs:** `88d2529` (HEAD), `10f9847`

**本轮完成：**
- 修正 `dev-project-harness-loop/scripts/codemap.js` 的 `trackedSrcCount` 计算逻辑：现在只统计 **tracked source files**（`ts/tsx/js/jsx/go/py`），不再把整个仓库的 tracked 文件总数误记进去
- 实测 codemap cache 行为：
  - clean worktree 第二次运行会 **skip**
  - dirty tracked source file 会 **强制重建**
- 将验证日志落盘到 `harness/artifacts/verification/`
- 同步 `.gitignore`，屏蔽生成型 artifacts 噪音：`codemap.md`、`codemap.meta.json`、`verification/`
- 回填并对齐项目记录：`ACTIVE.md`、`features.json`

**验证：**
- `node dev-project-harness-loop/scripts/codemap.js . --output harness/artifacts/codemap.md`
- temp git worktree clean/dirty 回归：见 `harness/artifacts/verification/codemap-clean-dirty.log`
- `bash scripts/run_drift_check.sh`
- `bash scripts/run_trinity_guard.sh`
- `bash init.sh`
- `find . -name '*.js' -not -path './node_modules/*' -exec node --check {} \;`
- `grep -c 'TODO' CLAUDE.md AGENTS.md harness/goal.md | grep -q '0'`
- `bash tests/smoke.sh`
- temp scaffold smoke：见 `harness/artifacts/verification/scaffold-smoke.log`

**结论：**
- Trinity 主仓当前 guard/ smoke/ scaffold 主链路均已通过
- `trackedSrcCount` 遗留问题已复现并修复，cache 判定恢复可信
- 当前剩余工作主要是是否要把这批本地修正直接 commit / push

---

## 2026-04-04 — 补齐 Trinity 合规骨架
**commit:** `0a86e34` (feat: close v5 preview continue-gate result flow)

**本轮完成：**
- 生成 7 个必需文件：CLAUDE.md、AGENTS.md、CHANGELOG.md、features.json、init.sh、harness.json、docs/architecture.md
- 生成 tests/smoke.sh
- 安装 guard 脚本：scripts/run_drift_check.sh、scripts/run_change_guard.sh
- 填充 CLAUDE.md / harness/goal.md / features.json 实际内容
- init.sh 可执行，Node 语法检查通过

**剩余 gap（已消除）：**
- ✅ CLAUDE.md / AGENTS.md / features.json / init.sh / harness.json / docs/ — 全部就位
- ✅ scripts/run_trinity_guard.sh — 已安装
- ✅ 初始 CHANGELOG.md 条目已写入

**验证：**
- `bash scripts/run_drift_check.sh`
- `bash init.sh`
- `find . -name '*.js' -not -path './node_modules/*' -exec node --check {} \;`

---
