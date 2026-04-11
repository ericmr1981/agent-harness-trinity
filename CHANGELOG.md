# Progress Log

## 2026-04-11晚 — Round 2：四维评分 + ContextAssembler profile 门控
**refs:** `ffd51a3...HEAD`
**status:** local verified

**本轮完成：**
- `harness.js`：四维评分（scope/coordination/context/risk 各 1-10）替代旧式单一 complexity；context profile 按需计算而非按 complexity 推导；attachment tier 跟随 context profile 而非 complexity；`planningSignals` → `buildMatrixFlags`（更精确的 flag 推导）；`parseTASKS` 支持 vNext 表格格式；主流程调整为 preflight → scan → LLM → clarification → signals → contextAssembler
- `context-assembler.js`：`--profile minimal|standard|full` + `--target subagent|verifier`；`deriveSectionPlan()` 按 profile 决定 section 归属（required/conditional/on-demand）；`buildContextMeta()` 生成 `.json` 元数据文件；context package header 标注 profile/target/sections

**验证：**
- `node --check harness.js + context-assembler.js` ✅
- `bash tests/smoke.sh` ✅
- `bash tests/regressions.sh` ✅

---

## [Pending] Round 3：Attachment Profile 差异化 + Brief 增强
**目标：** 让附件策略和 Brief 内容真正跟随 context profile 差异化

**待改项：**
1. `buildAttachments`：按 `plan.attachmentTier`（minimal/standard/full）+ `plan.contextProfile` 生成 3 种密度附件
   - minimal: 无附件
   - standard: TEMPLATE_BRIEF + sprint contract + focused snippets（contextAssembler 产出的 focused snippets）
   - full: 上述全部 + features.json + codemap.md + master-brief.md
2. `buildMasterBrief`：新增 `## Planning Signals` section（输出四维分数）+ `## Context Profile` 说明
3. `printReport`：输出改为 `Context Profile + Planning Signals` 而非旧 complexity 格式
4. `--continue` 模式：自动从 `harness/context/` 读取最新 context-package + registry.json
5. ContextAssembler `--include-handoffs` on-demand flag（目前 handoffs section 默认关闭）

---

## 2026-04-11傍晚 — Round 1：索引与项目宪章收口
**refs:** `af211f3`
**status:** local verified

**本轮完成：**
- 删除 repo 级 `CLAUDE.md`，将项目使命 / 约束并入 `harness/goal.md`
- 新增 `TASKS.md` 作为唯一项目索引，停用旧 `WORKSPACE.md`
- `harness.js` 不再维护 `WORKSPACE.md`，改写 `TASKS.md` 活跃项目索引
- `run_drift_check.sh` / `smoke.sh` / `scaffold_harness.sh` / README / SKILL docs 同步到新最小文件集
- 清理旧的 tracked runtime artifacts（`harness/assignments/assign-*.md`、`harness/contracts/sprint-*.md`）并补全 `.gitignore`

**验证：**
- `bash init.sh` ✅
- `bash scripts/run_drift_check.sh` ✅
- `bash tests/smoke.sh` ✅
- `bash tests/regressions.sh` ✅
- `bash scripts/run_trinity_guard.sh` ✅
- `node --check dev-project-harness-loop/scripts/harness.js` ✅

## 2026-04-11下午 — 最小修补：codemap 噪音、shell 统计、self-contained regressions
**refs:** `f0c1806`
**status:** local verified

**本轮完成：**
- `codemap.js` 不再通过 `cat package.json` 探测框架；无 `package.json` 的仓库不再向 stdout 打 `No such file or directory`
- `codemap.js` 语言统计纳入 `.sh`，避免 Trinity 这类 shell-heavy 仓库被误报成纯 JS/Python
- `tests/regressions.sh` 改为默认使用当前 repo 作为 `OPENCLAW_WORKSPACE`，不再硬依赖 `mike-product-calc`
- `tests/smoke.sh` 现在串联回归测试，避免只有语法/文件存在检查
- `features.json` 的 F-003 文案改为“最小 harness 骨架（含 TODO 占位）”，把能力边界说实话

**验证：**
- `node --check dev-project-harness-loop/scripts/codemap.js` ✅
- `node dev-project-harness-loop/scripts/codemap.js . --force --output /tmp/trinity-codemap-audit.md` ✅（无 `cat: package.json` 噪音）
- `bash tests/regressions.sh` ✅
- `bash tests/smoke.sh` ✅
- `bash scripts/run_drift_check.sh` ✅

## 2026-04-10上午 — sync manifest 补齐 codemap.js，确保全局同步不会漏掉
**status:** local fix ready

**本轮完成：**
- 将 `dev-project-harness-loop/scripts/codemap.js` 补入 `scripts/sync_skills.sh` 的 `MANIFEST`
- 修复一个实际漏同步问题：之前即使 repo 已 push、也执行了 `--sync --global`，全局目录里的 `codemap.js` 仍不会更新，因为它根本不在清单里

**验证：**
- 已确认旧 manifest **缺少** `codemap.js` 条目 ✅
- 已确认全局目录原先存在旧版 `codemap.js`，但没有 `.synctag` sidecar，且不含 Invocation 反馈字段 ✅

## 2026-04-10上午 — codemap 增加调用反馈：知道脚本是否真的被调用
**status:** local verified

**本轮完成：**
- `codemap.md` 新增 `生成反馈（Invocation）` 区块，明确写出：`调用确认`、`Invocation ID`、`调用脚本`、`调用来源`、`请求方`、`生成时间`、`输出文件`
- `codemap.meta.json` 新增 `invocation` 对象，version 升至 **5**
- `codemap.js` stdout 现在会打印 `Invocation ID / Invoked via / Requested by`
- `harness.js` 调用 codemap 时会显式注入：`CODEMAP_CALLER=harness.js`、`CODEMAP_REQUESTED_BY=trinity-harness`

**验证：**
- `node --check dev-project-harness-loop/scripts/codemap.js` ✅
- `node --check dev-project-harness-loop/scripts/harness.js` ✅
- MC-Gen 临时生成文件已出现 `生成反馈（Invocation）` 区块 ✅
- MC-Gen meta 已出现 `invocation` 对象，`version: 5` ✅

## 2026-04-10上午 — codemap 使用建议文案收窄：skill 仓 vs 带 harness 层的业务仓
**status:** local + mc-gen wording verified

**本轮完成：**
- 调整 `codemap.js` 的“使用建议”生成逻辑，不再把所有带 `harness/` 的仓库都粗暴描述成 `skill / harness` 类型
- 对真正的 skill 仓继续提示关注 `SKILL.md` / `harness/` / 关键配置文件
- 对像 MC-Gen 这样的业务仓，改为提示“本仓库带有 harness 治理层”，并明确检查 `features.json`、`harness/`、测试、启动脚本、文档的显式引用

**验证：**
- `node --check dev-project-harness-loop/scripts/codemap.js` ✅
- MC-Gen 重新生成 codemap 后，“使用建议”末条已变为更准确的人话版 ✅

## 2026-04-10上午 — codemap.js v4：真实语言检测 + --output 解析修复 + meta 版本升至 4
**status:** local + mc-gen regression verified

**本轮完成：**
- **语言检测重构**：用实际源码文件扩展名（`.js/.ts/.tsx/.py/.go`）统计替代旧的 `package.json` 依赖猜測，返回 `"TypeScript + JavaScript + Python"` 等真实混合标签；不再把含 JS 的 Express/React 项目误判为纯 TypeScript
- **新增语言分布行**：`codemap.md` 基础信息表新增 `语言分布 | js:37 / ts:27 / tsx:19 / py:3` 行，meta.json 同步写入 `langInfo` 块（version → 4）
- **--output 参数解析修复**：旧的 `find prev index + 1` 在 `--force` 先行时失败；改为顺序无关的标志位解析循环
- `detectFramework()` 移除已废弃的 `language` 返回字段

**MC-Gen 回归验证：**
- Language: `TypeScript + JavaScript + Python` ✅（之前错误显示 `TypeScript`）
- 语言分布：`js:37 / ts:27 / tsx:19 / py:3` ✅（对应 MC-Gen 实际文件数）
- F-008（无路由假阳性）✅ / F-009（职责分层 + 文档引用）✅
- meta version: 4 ✅ / langInfo.label ✅

**下一步：**
- 可选：把 codemap v4 的 verify 命令更新到 features.json（F-008 / F-009 的 `rg '...' codemap.md` 检查逻辑不变）

## 2026-04-10上午 — sync_skills.sh 修复：untagged 自动收编 + sidecar 版本标记 + force 真正生效
**status:** local + global verified

**本轮完成：**
- 修复 `sync_skills.sh` 第一处行为 bug：`untagged` 文件现在在普通 `--sync` 下就会被**真正更新并收编**，不再假装成功却要求额外 `--force`
- 修复第二处行为 bug：`--sync --force` 现在对 `✅ up-to-date` 文件也会**实际重写**，符合脚本帮助文案“即使已同步也强制重写”
- 修复底层设计 bug：版本追踪从**内联注释**改为 sidecar `*.synctag` 文件，避免把 HTML 注释塞进 ESM `.js` / `index.json` 里导致语法污染
- 全局 OpenClaw skills 已重新用新脚本 `--sync --global --force` 刷新并修复

**验证：**
- `bash -n scripts/sync_skills.sh` ✅
- `bash /tmp/trinity_sync_sidecar_validate.sh` ✅（untagged → plain `--sync` 自动生成 `.synctag`）
- `bash /tmp/trinity_sync_force_validate.sh` ✅（up-to-date + stale inline tag → `--sync --force` 真重写）
- `node --check /usr/local/lib/node_modules/openclaw/skills/dev-project-harness-loop/scripts/harness.js` ✅
- `node --check /usr/local/lib/node_modules/openclaw/skills/dev-project-harness-loop/scripts/context-assembler/context-assembler.js` ✅
- `NO_INLINE_TAGS` ✅；关键 sidecar 文件存在 ✅

**下一步：**
- 可选：把 `HARNESS-INSTALL-GUIDE.md` / `README.md` 关于 `sync_skills.sh` 的版本说明更新为 sidecar 机制，避免文档继续描述旧的“文件头部注释”方案

---

## 2026-04-10早 — Minimal Ralph Upgrade / Batch 3
**status:** local done

**本轮完成：**
- `features.json.acceptanceCriteria` 现在支持**结构化对象**（`id/title/verify/negativeTest/evidence`），同时兼容旧的字符串数组
- 新增 `buildFeatureOracle()`：把 feature 级 `verify + acceptanceCriteria.verify/negativeTest` 编译成 feature-specific `localOracle / finalOracle`
- `continueGate` 现携带 `selectedFeatureId / selectedFeatureTitle / acceptanceCriteria / acceptanceSummary`
- `masterBrief`、`sprint contract`、`post-task report`、CLI summary 现在都会显示 feature acceptance 信息
- `ContextAssembler` 在 unfinished features 摘要中增加 `acceptanceCriteriaCount`

**验证：**
- `node --check dev-project-harness-loop/scripts/harness.js` ✅
- `node --check dev-project-harness-loop/scripts/context-assembler/context-assembler.js` ✅
- 通过**临时 repo 副本**注入 `F-999` 待办 feature，非 dry-run 跑 harness，确认：
  - `ACTIVE.md` 含 `FEATURE_ORACLE`
  - contract / report 显示 `Feature Acceptance Criteria`
  - `Final Oracle / Local Oracle` 已由 feature criteria 编译生成

**下一步：**
- 评估是否要做 Batch 4：让 `consume-result` 能按 feature id 自动回写 `features.json` 的 `passes/status`，完成“任务状态 → 验收 → 记录”闭环

---

## 2026-04-10早 — Minimal Ralph Upgrade / Batch 2
**status:** local done

**本轮完成：**
- `appendRoundLearning()` 在每轮 harness 结果落盘后**自动**把一个结构化 entry 追加到 repo `AGENTS.md` 的 `<!-- LEARNINGS_BLOCK -->` 受控区块
- Entry 格式：`日期 | roundOutcome | blocker | Insight（一句话）| Evidence`
- `deriveInsight()` 对 6 种不同 outcome 返回对应的简短 insight 句子
- AGENTS.md 已预置 `<!-- LEARNINGS_BLOCK -->...<!-- LEARNINGS_END -->` 标记（无学习时区块为空）

**验证：**
- `node --check dev-project-harness-loop/scripts/harness.js` ✅
- `rg 'LEARNINGS_BLOCK|appendRoundLearning' dev-project-harness-loop/scripts/harness.js` ✅

**下一步：**
- Batch 3：把 features.json 的 `acceptanceCriteria` 字段和 harness 的 oracle/验收体系打通（让 feature entry 本身带可执行验收）

---

## 2026-04-10早 — Minimal Ralph Upgrade / Batch 1
**status:** local done

**本轮完成：**
- `harness.js` 增加 `features.json` 轻量故事队列读取能力（支持数组根格式）
- 默认从 backlog 中只选择 **一个** 可执行 feature 进入本轮 dispatch（single-story-by-default）
- 增加 story gate：`size=L`、`status=split_required`、或 acceptance criteria 过多的 feature 不再直接执行，而是返回 `split_required`
- multi-agent 仅在**没有 feature backlog 约束**且确实是高复杂度独立任务时保留
- `ContextAssembler` 现已能识别增强后的 `features.json` 结构，并把 `id/status/priority/size` 带入 context

**验证：**
- `node --check dev-project-harness-loop/scripts/harness.js`
- `node --check dev-project-harness-loop/scripts/context-assembler/context-assembler.js`
- `node dev-project-harness-loop/scripts/context-assembler/context-assembler.js . "pick next feature from features queue"`

**下一步：**
- Batch 2：把每轮 learnings 默认写回 repo 的固定位置（优先考虑 `AGENTS.md` 的受控区块）

---

## 2026-04-09深夜 — 补充本地同步 runbook（repo → runtime）
**status:** done

**本轮完成：**
- 在 `README.md` 的“更新方式”下新增 **一键同步到本地运行环境（推荐）**
- 明确推荐命令：
  - `git pull origin main`
  - `bash scripts/sync_skills.sh --sync`
  - `bash scripts/install_skills.sh --agent jarvis --with-subagent-lite`
- 在 `HARNESS-INSTALL-GUIDE.md` 中补充“如何同步到 Jarvis 运行时”的解释与 dry-run 用法
- 明确说明：
  - `sync_skills.sh` 负责 manifest / SYNCTAG 管理的增量同步
  - `install_skills.sh` 负责把核心 skill 目录整体补齐，避免 repo 与实际运行态不一致

**验证：**
- `rg -n "一键同步到本地运行环境|sync_skills\.sh --sync|install_skills\.sh --agent jarvis --with-subagent-lite" README.md HARNESS-INSTALL-GUIDE.md`

---

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
