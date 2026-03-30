# harness-dispatch — v3

**Enforcement layer: ALL subagent dispatches MUST route through here.**

> Part of agent-harness-trinity | https://github.com/ericmr1981/agent-harness-trinity
> harness.js v3.0

---

## ⚠️ MANDATORY RULE

**No subagent dispatch may bypass this skill.**

Every task that needs a subagent must go through `harness.js v3`:
1. Dynamic project discovery (no hardcoded names)
2. Repo auto-scan
3. **LLM task analysis** (task profile + enhanced brief)
4. Clarification on missing critical info
5. Sprint plan generation (single or multi-agent with dependencies)
6. Dependency-ordered dispatch
7. Formal failure recovery (L0/L1/L2, max 2 retries)

Direct `sessions_spawn` calls for project work are **prohibited**.

---

## 🚀 Usage

Triggered when user says:
- `/harness <task>`
- `使用 harness 创建任务 <task>`
- `用 harness 跑：为 <project> <task>`
- Any pattern indicating a subagent dispatch is needed

---

## 📋 Full Dispatch Flow v3

### Step 1 — Execute harness.js

```javascript
const HARNESS = '/Users/ericmr/Documents/GitHub/agent-harness-trinity/dev-project-harness-loop/scripts/harness.js';
const { stdout } = await exec(`node "${HARNESS}" "${taskDescription}"`, { timeout: 60_000 });
```

### Step 2 — LLM Task Analysis (core new feature)

harness.js v3 calls LLM (OpenAI-compatible, with fallback):

```
analyzeTaskWithLLM() → {
  taskProfile: { taskType, skillsNeeded, agentSuggestions, complexity, riskLevel, scopeGuess },
  enhancedBrief: "...",          // LLM writes the actual architectural guidance
  needsClarification: bool,
  clarificationQuestions: [...],
  isMultiAgent: bool,
  agentPlan: [{ sprintId, role, scope, dependsOn }]
}
```

**Fallback**: when no API key available → keyword scoring (pure JS, no LLM call).

### Step 3 — Clarification

- `needsClarification=true` → critical info missing (project name, game rules, etc.)
- Write `.harness-clarification-pending.json`
- Infer from ACTIVE.md / TASKS.md if possible
- Critical missing info → ask Boss before proceeding

### Step 4 — Sprint Plan

```javascript
// Single-agent: one sprint
// Multi-agent: one sprint per distinct role, dependsOn chain
generateSprintPlan() → {
  sprints: [
    { sprintId, role, scope, dependsOn: [], agent, brief },
    ...
  ],
  masterBrief: "..."   // for all sprints to share
}
```

### Step 4.5 — Confirm Sprint Plan with Boss

**⚠️ Mandatory confirmation before dispatch:**

After `harness.js` completes LLM analysis + sprint plan generation, **always confirm with Boss** before spawning subagents — even when `needsClarification=false`.

**Why:** LLM analysis can misjudge scope/complexity. Today's case: scope was judged "single-file" but actual work involved tetris.ts + types.ts + app.ts. Without confirmation, wrong scope → wrong agent → subagent struggles → 503.

**When to confirm (all cases):**
- Every task, without exception
- Read the generated `master-brief-<ts>.md` + sprint plan
- Tell Boss: what the LLM thinks the scope/complexity/risk is
- Ask: "是这个方向吗？范围理解对吗？"

**Format for Boss confirmation:**
```
✅ LLM 任务理解：
- 复杂度：X/5 | 风险：Y
- 范围：<scope from LLM>
- 预计 sprint 数：<N>
- 涉及文件：<files from brief>

是这个方向吗？
```

**If Boss says go:** Continue to Step 5.  
**If Boss corrects scope/goal:** Update brief → then Step 5.

> **Exception:** If Boss explicitly says "直接跑，不用确认" for a task type, record that preference and skip confirmation for that pattern. Otherwise, always confirm.

**⚠️ Channel-aware session mode rule:**

- `mode="session"` requires `thread=true`
- `thread=true` only works on **Discord** (currently the only supported channel)
- On **Telegram** (and other non-thread channels): `thread=true` silently fails → zombie session (session created but never activated, 0 tokens)
- **Action:** When current channel is Telegram, **always use `mode="run"`** — never attempt `mode="session"`

**Detection logic:**
```javascript
// Check current channel from inbound metadata
const channel = inbound_meta?.channel; // "telegram" | "discord" | etc.

// On Telegram: force mode="run"
const effectiveMode = (channel === "telegram") ? "run" : (spawnConfig.mode || "run");
```

**Dispatch:**
```javascript
// dispatchSprints():
//   Topological sort by dependsOn
//   For each sprint in order:
//     read .harness-spawn-sprint-<id>.json
//     if (channel === "telegram") force mode="run"
//     sessions_spawn({ task, attachments, mode: effectiveMode, ... })
//     wait for completion before dispatching dependents
```

> **Why not session on Telegram?** Even if `sessions_spawn` returns `childSessionKey`, the session is a zombie — it exists but never executes. The error "thread=true is unavailable because no channel plugin registered subagent_spawning hooks" confirms Telegram has no thread plugin hook. Avoid wasting tokens on zombie sessions.

### Step 6 — Formal Failure Recovery

**⚠️ Announce 503 特殊情况（先于下表处理）：**

Subagent 执行完成但 announce 步骤遇到 503 时，工作可能已实际完成。处理流程：

```
收到 subagent 完成通知（status=failed，reason="503"）
    │
    ▼
① 检查 session token 消耗
    ├── tokens > 0 → 子代理执行过，继续步骤 ②
    └── tokens = 0 → 无执行记录，归类为 L2，重新 spawn
    │
    ▼
② 检查实际文件变更
    ├── 有新 commit / features.json 变化 → 工作实际完成
    │   → 运行 L0/L1 验证
    │   → 验证通过 → 视为部分成功，不消耗 retry 次数
    │   → 验证失败 → 归类 L0/L1，正常 retry
    │
    └── 无变更 → 子代理被中断，归类为 L2，重新 spawn
```

**⚠️ 关键原则：** 503 announce 失败 ≠ 工作失败。先验证，再决策。

---

| Failure Type | Evidence | Action | Retries |
|---|---|---|---|
| L0 (architecture) | subagent returns file list, not code | Fix brief, retry | max 2 |
| L1 (logic) | build/test exits non-zero | Attach error log, retry | max 2 |
| L2 (timeout/announce-503) | session ends but features.json unchanged | Split task, retry | max 2 |
| After 2 failures | — | Write escalation + notify Boss | — |

---

## 🔑 Key Enforcement Points (v3)

| Rule | v2 | v3 |
|---|---|---|
| Project discovery | Hardcoded KNOWN_REPOS | Dynamic: TASKS.md → ACTIVE.md → github-scan |
| Task analysis | Pure keyword scoring | LLM profiling (with fallback) |
| Enhanced brief | Template + file list | LLM generates actual architectural guidance |
| Missing info | Not handled | Clarification flow with critical question list |
| Multi-agent | Not supported | LLM detects + generates agentPlan with dependsOn |
| Dispatch order | All at once | Topological sort by dependsOn |
| Attachments | 6 fixed files | 7 (added sprint contract per role) |

---

## 📁 File Locations (v3)

| File | Path |
|---|---|
| harness.js | `agent-harness-trinity/dev-project-harness-loop/scripts/harness.js` |
| Master brief | `harness/assignments/master-brief-<ts>.md` |
| Sprint contracts | `harness/contracts/sprint-*.md` |
| Sprint spawn configs | `.harness-spawn-sprint-<id>.json` |
| Clarification pending | `.harness-clarification-pending.json` |
| Master dispatch record | `.harness-master.json` |

---

## 🧪 v3 New Features Summary

| Feature | How it works |
|---|---|
| **LLM task profiling** | `analyzeTaskWithLLM()` → JSON task profile + enhanced brief |
| **Dynamic project discovery** | `discoverProject()` checks TASKS.md → ACTIVE.md → github scan |
| **Clarification flow** | `handleClarification()` writes pending file, asks Boss if critical |
| **Multi-agent orchestration** | LLM detects multi-role tasks → `generateSprintPlan()` with dependsOn |
| **Dependency-ordered dispatch** | `dispatchSprints()` topological sort, waits for deps |
| **7 attachments** | Added sprint contract per role (6 + sprint contract) |
| **No project hardcoding** | All project names derived from TASKS.md or scanned from filesystem |

---

## ✅ Acceptance Criteria

- [x] All subagent dispatches go through harness.js v3
- [x] LLM task profiling (with fallback when no API key)
- [x] Dynamic project discovery (no hardcoded project names)
- [x] Clarification flow for missing critical information
- [x] Multi-agent sprint plan with dependency ordering
- [x] Formal failure recovery (L0/L1/L2, max 2 retries)
- [x] ACTIVE.md updated with sprint plan
- [x] All artifacts written to harness/ directory
