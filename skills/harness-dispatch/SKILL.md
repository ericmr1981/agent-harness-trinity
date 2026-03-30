# harness-dispatch — v4

**Enforcement layer: ALL subagent dispatches MUST route through here.**

> harness.js v4.0 | agent-harness-trinity

---

## ⚠️ MANDATORY RULE

**No subagent dispatch may bypass this skill.**

Every task that needs a subagent must go through `harness.js v4`.

Direct `sessions_spawn` calls for project work are **prohibited**.

---

## 🚀 Usage

### Step 0: Pre-compute complexity score

Before calling harness.js, the main agent **pre-computes** the complexity score (0-10) using the Complexity Score Card:

| 指标 | 0 分 | 1 分 | 2 分 |
|------|------|------|------|
| 涉及文件数 | 1 | 2-5 | >5 |
| 代码行改动量 | <20 | 20-200 | >200 |
| 测试覆盖 | 有 | 部分 | 无 |
| 多角色依赖 | 无 | 1种 | 2+种 |
| 用户可见变更 | 无 | 小改 | 核心功能 |

**总分 = Σ**（满分 10 分）

| 总分 | → Profile | → Mode | → Attachments |
|------|----------|--------|--------------|
| 0-2 | Solo | `--mode minimal` | 无附件 |
| 3-4 | Solo/PG | `--mode keyword` | TEMPLATE_BRIEF + contract |
| 5-6 | PG/PGE-final | `--mode llm` | full |
| 7-10 | PGE-sprint | `--mode llm-full` | full + sprint contract |

### Step 1: Trigger patterns

- `/harness <task>`
- `使用 harness 创建任务 <task>`
- `用 harness 跑：为 <project> <task>`
- `持续推进 <project>`（当需要 subagent 时）
- 任何需要 subagent 的项目工作

### Step 2: Run harness.js

```bash
node "/path/to/dev-project-harness-loop/scripts/harness.js" \
  --mode <minimal|keyword|llm|llm-full> \
  --complexity <0-10> \
  "<task description>"
```

**参数说明：**

| 参数 | 必填？ | 说明 |
|------|--------|------|
| `--mode` | 否（默认 `llm`）| minimal=无LLM无扫描；keyword=关键词分析；llm=完整LLM分析；llm-full=LLM+多agent |
| `--complexity` | 否（默认 auto）| 预先计算的分值（0=自动计算）|
| `--dry-run` | 否 | 只打印报告，不写入文件 |

### Step 3: Boss confirmation（必须）

**所有任务都需要确认**，即使 `needsClarification=false`。

格式：
```
✅ LLM 任务理解：
- 复杂度：X/10 | 模式：<mode>
- 预计 sprint 数：<N>
- 涉及文件：<files from brief>
- 附件策略：<minimal|standard|full>
- 选用 Agent：<agent-id>

是这个方向吗？
```

### Step 4: Parse spawn config + sessions_spawn

harness.js 生成 `.harness-spawn-<sprint-id>.json`，包含：
```json
{
  "sprintId": "sprint-1",
  "task": "...",
  "role": "engineering-frontend-developer",
  "agent": { "id": "...", "file": "..." },
  "attachments": ["skills/...", "TEMPLATE_BRIEF.md"],
  "attachmentTier": "standard",
  "matrixFlags": [...]
}
```

读取 `attachments` 字段，注入到 `sessions_spawn` 的 `attachments` 参数。

**Telegram 规则（v4）：**
```javascript
const channel = inbound_meta?.channel;
const effectiveMode = (channel === "telegram") ? "run" : "session";
```

### Step 5: Formal Failure Recovery

| Failure Type | Evidence | Action | Retries |
|---|---|---|---|
| L0 (build) | build exits non-zero | Attach error log, fix brief, retry | max 2 |
| L1 (test) | test fails | Classify: flaky / real bug / test bug, fix | max 2 |
| L2 (UX/announce-503) | session ends but features.json unchanged | Split task, retry | max 2 |
| After 2 failures | — | Write escalation + notify Boss | — |

**503 优先验证原则**：503 announce 失败 ≠ 工作失败。先验证，再决策。

---

## 📋 Mode × Attachment × Token 对照

| Mode | LLM Call | Repo Scan | Attachments | 典型 Token 消耗 |
|------|:---------:|:---------:|------------|--------------|
| `--mode minimal` | ❌ | ❌ | 无 | ~50 tokens（main session）|
| `--mode keyword` | ❌ | ✅ | TEMPLATE_BRIEF + contract（~800 tokens）| ~300 tokens |
| `--mode llm` | ✅ | ✅ | full 5-6 文件（~2500 tokens）| ~4000 tokens |
| `--mode llm-full` | ✅ + multi-agent | ✅ | full + sprint contracts | ~6000+ tokens |

**建议**：
- 改错别字 / 改端口 → `--mode minimal`
- 单文件改动 / 小功能 → `--mode keyword`
- 多文件 / 架构相关 → `--mode llm`
- 复杂多角色任务 → `--mode llm-full`

---

## 🔑 Key Enforcement Points (v4)

| Rule | v3 | v4 |
|------|----|----|
| Mode selection | fixed LLM | complexity-driven auto |
| Attachments | fixed 6-7 files | tiered: 0 / 2 / 5-6 files |
| Complexity scoring | LLM-only | main agent pre-computes |
| Agent selection | keyword + LLM suggestion | decision tree + LLM |
| Token tracking | none | harness.js tracks estimates |
| Post-task report | none | harness/reports/sprint-*-report.md |
| Templates | TEMPLATE_ASSIGN + TEMPLATE_HANDOFF | TEMPLATE_BRIEF（合并）|

---

## 📁 File Locations (v4)

| File | Path |
|------|------|
| harness.js | `dev-project-harness-loop/scripts/harness.js` |
| Post-task report | `harness/reports/sprint-<id>-report.md` |
| Master brief | `harness/assignments/master-brief-<ts>.md` |
| Sprint contracts | `harness/contracts/sprint-*.md` |
| Sprint spawn configs | `.harness-spawn-sprint-<id>.json` |
| Master dispatch record | `.harness-master.json` |

---

## ✅ Acceptance Criteria

- [x] All subagent dispatches go through harness.js v4
- [x] Complexity score card integrated (pre-compute by main agent)
- [x] Mode selection drives attachment volume and LLM usage
- [x] Selective attachments (0 / 2 / 5-6 files)
- [x] TEMPLATE_BRIEF.md merges assignment + handoff
- [x] Token tracking in .harness-master.json
- [x] Post-task report scaffold generated
- [x] Agency agent decision tree (action × target matrix)
- [x] Formal failure recovery (L0/L1/L2, max 2 retries)
- [x] ACTIVE.md updated with mode + attachment tier
