# Trinity 文件级关系图

> **用途**：理解所有文件之间的调用/引用关系，供维护者和 AI agent 导航使用  
> **更新**：2026-03-30

---

## 图例

```
[A]  技能（SKILL.md）         ⟨F⟩  生成物（harness artifacts）
[S]  脚本                     [R]  参考文档（references）
[■]  配置/索引/元数据           ↗   调用/依赖
```

---

## 整体调用关系

```
┌──────────────────────────────────────────────────────────────────────┐
│                          用户请求                                      │
│   /harness <task>          或          直接主 session 对话              │
└────────────┬─────────────────────────────────┬──────────────────────┘
             │                                  │
             ▼                                  ▼
┌────────────────────────┐           ┌─────────────────────────────┐
│   harness-dispatch      │           │  dev-project-harness-loop   │
│   [A] SKILL.md          │           │   [A] SKILL.md              │
│   ⚠️ 强制门卫            │           │   完整操作系统               │
│   所有 subagent 必须过   │           │                             │
└────────────┬───────────┘           └──────────────┬──────────────┘
             │                                      │
             │ ↗ harness.js v3                      │ 包含
             ▼                                      ▼
┌────────────────────────┐           ┌─────────────────────────────┐
│ harness.js             │           │ dev-project-autoloop         │
│ [S] scripts/harness.js  │           │ [A] SKILL.md                 │
│                        │           │ bounded bet loop             │
│ - discoverProject()    │           │ verify oracle                │
│ - scanRepo()           │           │ commit/log                   │
│ - analyzeTaskWithLLM() │           └──────────────┬──────────────┘
│ - handleClarification()│                        │
│ - generateSprintPlan() │           ┌──────────────┴──────────────┐
│ - dispatchSprints()    │           ▼                              ▼
│ - failure recovery      │   ┌─────────────────┐  ┌──────────────────┐
└────────────┬───────────┘   │ project-harness- │  │  subagent-coding │
              │               │ guards [A]        │  │  -lite [A]       │
              │               │                   │  │                  │
              ▼               │ scripts/:         │  │ SKILL.md         │
┌────────────────────────┐    │   scaffold_       │  │ TEMPLATE_*.md    │
│ Generated Artifacts    │    │     harness.sh    │  │ references/      │
│ ⟨F⟩                    │    │   run_change_     │  │                  │
│                        │    │     guard.sh      │  └────────┬─────────┘
│ harness/               │    │   run_drift_      │           │
│   assignments/         │    │     check.sh      │           │
│     master-brief-*.md  │    │                   │           │
│   contracts/           │    │ record-root-pack/ │           │
│     sprint-*.md        │    └───────────────────┘           │
│   .harness-master.json │                                     │
│   .harness-spawn-*.json│                                     │
│   .harness-clarification-pending.json                       │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼ sessions_spawn
                    ┌─────────────────────────┐
                    │   Subagent              │
                    │                         │
                    │  接收 attachments:      │
                    │   1. dev-project-       │
                    │      harness-loop/SKILL  │
                    │   2. subagent-coding-   │
                    │      lite/SKILL          │
                    │   3. TEMPLATE_ASSIGN*   │
                    │   4. TEMPLATE_HANDOFF*  │
                    │   5. agency-agents-lib/ │
                    │      agents/<role>.md    │
                    │   6. sprint contract    │
                    │                         │
                    │  返回 Handoff Packet    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   Main Agent            │
                    │   重新验证 → 守卫 →      │
                    │   commit → 更新          │
                    │   CHANGELOG.md          │
                    └─────────────────────────┘
```

---

## 技能 → 技能 调用/依赖矩阵

| 被调用方 → | harness-dispatch | harness-loop | autoloop | guards | subagent-lite | agency-lib |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| **harness-dispatch** | — | ↗ reads | — | — | ↗ injects | ↗ injects |
| **harness-loop** | called by | — | contains | contains | — | — |
| **autoloop** | — | contained | — | — | — | — |
| **guards** | — | contained | — | — | — | — |
| **subagent-lite** | calls | called by | — | — | — | ↗ injects role |
| **agency-lib** | injects | — | — | — | injected by | — |

---

## 文件级别引用关系（按目录）

### `/` （根目录配置）

| 文件 | 用途 | 被谁引用 |
|------|------|---------|
| `scripts/install_skills.sh` | 安装脚本 | 用户手动执行 |
| `HARNESS_LINKS.md` | repo ↔ record-root 映射 | — |
| `ACTIVE.md` | 当前 WIP 状态 | harness.js（discoverProject） |
| `harness/` | 所有生成 artifacts | — |

### `dev-project-harness-loop/`

| 文件 | 用途 | 被谁引用 |
|------|------|---------|
| `SKILL.md` | 完整操作系统定义 | harness-dispatch（attachment）、主 session |
| `scripts/harness.js` | 调度引擎 | harness-dispatch SKILL.md |
| `scripts/.harness-master.json` | 主调度记录 | harness.js |
| `scripts/.harness-spawn-sprint-*.json` | Sprint spawn 配置 | harness.js |
| `references/goal-contract-template.md` | goal.md 模板 | 主 agent |
| `references/assignment-header.md` | assignment 头模板 | 主 agent |
| `references/sprint-contract-template.md` | sprint 合同模板 | 主 agent |
| `references/harness-profiles.md` | profile 选择指南 | 主 agent |
| `references/minimal-flow-example.md` | 最小可用示例 | 主 agent |
| `references/qa-report-template.md` | QA 报告模板 | verifier |
| `references/handoff-template.md` | handoff 模板 | subagent |
| `references/failure-recovery-protocol.md` | 失败恢复协议 | 主 agent |
| `references/auto-resume-protocol.md` | 自动续接协议 | 主 agent |
| `references/rubrics/*.md` | 评分细则 | verifier |

### `dev-project-autoloop/`

| 文件 | 用途 | 被谁引用 |
|------|------|---------|
| `SKILL.md` | 轻量执行循环 | 主 session、直接使用 |
| `references/project-template.md` | 项目模板 | scaffold |
| `references/runlog-template.md` | 运行日志模板 | 主 agent |
| `references/anthropic-effective-harnesses-mapping.md` | Anthropic 映射 | — |

### `project-harness-guards/`

| 文件 | 用途 | 被谁引用 |
|------|------|---------|
| `SKILL.md` | 脚手架 + 守卫定义 | 主 session |
| `scripts/scaffold_harness.sh` | 生成 harness 骨架 | 用户/harness-loop |
| `scripts/run_change_guard.sh` | 变更守卫 | 主 session、harness-loop |
| `scripts/run_drift_check.sh` | drift 检查 | 主 session、harness-loop |
| `record-root-pack/` | Obsidian record-root 模板 | 可选 |
| `references/harness-layout.md` | harness 布局规范 | — |
| `references/task-log-format.md` | 任务日志格式 | — |

### `subagent-coding-lite/`

| 文件 | 用途 | 被谁引用 |
|------|------|---------|
| `SKILL.md` | subagent 规范 | harness-dispatch（attachment） |
| `TEMPLATE_ASSIGNMENT.md` | assignment 模板 | 主 agent、harness-dispatch |
| `TEMPLATE_HANDOFF.md` | handoff 模板 | subagent |
| `references/role-charters.md` | 角色宪章 | 主 agent |

### `harness-dispatch/`

| 文件 | 用途 | 被谁引用 |
|------|------|---------|
| `SKILL.md` | 强制门卫规范 | 用户 /harness 命令入口 |
| `references/harness.js` | harness.js 源码引用 | SKILL.md |

### `agency-agents-lib/`

| 文件 | 用途 | 被谁引用 |
|------|------|---------|
| `SKILL.md` | 角色库说明 | 主 agent |
| `index.json` | 全部角色索引 | search 脚本 |
| `agents/engineering/*.md` | 26 个工程角色 | subagent（按需注入） |
| `agents/design/*.md` | 8 个设计角色 | subagent（按需注入） |
| `scripts/build_index.js` | 索引构建 | 维护时运行 |
| `scripts/search.js` | 角色搜索 | 用户/维护 |

---

## harness.js v3 执行阶段与产物

```
Phase 1: discoverProject()
    输入：taskDescription, TASKS.md, ACTIVE.md, github-scan
    输出：project { displayName, repoPath }
    产物：-

Phase 2: scanRepo()
    输入：project.repoPath
    输出：scan { files, packageJson, gitLog, features }
    产物：-

Phase 3: analyzeTaskWithLLM()
    输入：taskDescription, project, scan
    输出：llmResult { taskProfile, enhancedBrief, needsClarification, clarificationQuestions, isMultiAgent, agentPlan }
    产物：-

Phase 4: handleClarification() [conditional]
    输入：llmResult.needsClarification
    输出：clarificationAnswer
    产物：.harness-clarification-pending.json

Phase 5: generateSprintPlan()
    输入：llmResult
    输出：sprintPlan { sprints[], masterBrief }
    产物：harness/assignments/master-brief-<ts>.md
          .harness-spawn-sprint-<id>.json（每 sprint 一个）

Phase 6: dispatchSprints()
    输入：sprintPlan
    输出：sessions spawned
    产物：.harness-master.json

Phase 7: Formal Failure Recovery
    输入：failure type (L0/L1/L2)
    输出：retry or escalate
    产物：.harness-master.json（更新状态）
```

---

## Trigger 词 → 技能路由

| 用户说 | 路由到 | 说明 |
|--------|--------|------|
| `/harness <task>` | harness-dispatch | 强制门卫，所有 subagent 走这里 |
| `用 harness 跑：为 <proj> <task>` | harness-dispatch | 同上 |
| `持续推进这个项目` | dev-project-harness-loop | 主 session 自治 |
| `别每一步都问我` | dev-project-autoloop | 轻量自治循环 |
| `创建新项目 harness` | project-harness-guards | 脚手架搭建 |
| `实现 <feature>` | harness-dispatch | subagent 任务 |

---

*Last updated: 2026-03-30
维护者：当新增文件或修改引用关系时，同步更新本 MAP.md*
