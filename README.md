# Agent Harness Trinity

> **goal-closed, long-running agent work 的完整工具包**

---

## 一、是什么

三个核心技能 + 两个扩展技能，构成一个完整的"**执行 + 治理**"家族：

| 技能 | 定位 |
|------|------|
| `dev-project-harness-loop` | **完整操作系统**：合同优先 + 守卫验证 + 持久记录 |
| `dev-project-autoloop` | **执行循环**：bounded bet loop，commit/log/oracle-first |
| `project-harness-guards` | **脚手架 + 守卫**：repo 初始化 + 变更守卫脚本 |
| `subagent-coding-lite` *(扩展)* | **subagent 规范**：标准化 assignment/handoff/verification |
| `harness-dispatch` *(扩展)* | **强制入口门卫**：所有 subagent 调度必须走这里 |
| `agency-agents-lib` *(扩展)* | **专业角色库**：200+ 按需注入的 Builder/Verifier 角色 |

---

## 二、为什么存在

长线任务失败通常因为：

- **不可恢复** — 状态没有持久化
- **不可验证** — 没有 oracle
- **不可回退** — 没有安全保存点
- **目标发散** — 在任意阶段边界停下而非真正完成

本工具包将 **Git 仓库视为持久化状态机**，强制执行：

- 小而可逆的 bets
- 显式的验证 oracle
- commit-linked 进度日志
- 里程碑前的 guard 检查
- 结构化 artifacts（planner / builder / verifier 交接）
- **默认不打断人**，只在 blocker / 审批边界 / 重大转向时暂停

---

## 三、设计原则

- **最终目标是默认停止点**。不因某个子任务完成就停下。
- **对话用于编排，工件才是事实**。
- **验证优于乐观**。Builder 不能自我验收。
- **Subagent 是执行者，不是自治者**。主 agent 拥有最终验证、守卫、commit 权限和持久记录。

## 三点五、版本轨道

- **当前稳定基线**：`harness.js v4`
- **下一版本轨道**：`v5 Continue Gate + Pivot`
- **v5 目标**：堵住“最终 oracle 未通过但先进入汇报模式”的侧门；失败后默认继续修复，连续两轮无新证据时自动换策略并告知 Boss。
- **当前实现状态**：已落地 v5-preview scaffolding（`harness.js` 输出字段 + ACTIVE/report/contract 模板字段 + failure recovery / assignment header 规则），完整闭环仍待继续推进。
- 设计入口：
  - `skills/harness-dispatch/references/v5-continue-gate.md`
  - `dev-project-harness-loop/references/v5-continue-gate.md`

---

## 四、快速开始

### 1. 安装技能

```bash
# 安装到 workspace-level（推荐）
bash scripts/install_skills.sh --agent <your-agent-id>
# 含 subagent-coding-lite
bash scripts/install_skills.sh --agent <your-agent-id> --with-subagent-lite

# 安装到全局 skills（需手动同步）
bash scripts/install_skills.sh --dest /usr/local/lib/node_modules/openclaw/skills/
```

### 2. 为项目搭建 harness（首次）

```bash
cd /path/to/your/project
bash /path/to/agent-harness-trinity/project-harness-guards/scripts/scaffold_harness.sh
```

### 3. 使用 harness 工作

**方式 A — 主 session 自治**（适合不需要 subagent 的任务）：
直接阅读 `dev-project-autoloop/SKILL.md` 或 `dev-project-harness-loop/SKILL.md`，按bounded bet loop 执行。

**方式 B — 通过 harness-dispatch 调度 subagent**（强制入口）：
```
/harness <任务描述>
```
harness-dispatch 会：动态发现项目 → LLM 任务分析 → 生成 sprint 计划 → 按依赖顺序 spawn subagent。

---

## 五、harness-dispatch 调用流程（v3）

```
用户 /harness <task>
    │
    ▼
harness-dispatch SKILL.md  ← 【强制门卫，所有 subagent 必须过这里】
    │
    ▼
harness.js v3
    ├── discoverProject()        动态发现项目（TASKS.md → ACTIVE.md → github-scan）
    ├── scanRepo()               扫描 repo 结构
    ├── analyzeTaskWithLLM()     LLM 任务分析 + 生成增强 brief
    ├── handleClarification()     缺失信息时提问 Boss
    ├── generateSprintPlan()     生成单/多 agent sprint 计划（含依赖链）
    ├── dispatchSprints()        按依赖顺序 spawn subagent
    └── Formal failure recovery  L0/L1/L2 分级重试
    │
    ▼
inject 到 subagent 的 artifacts：
    1. dev-project-harness-loop/SKILL.md
    2. subagent-coding-lite/SKILL.md
    3. subagent-coding-lite/TEMPLATE_ASSIGNMENT.md
    4. subagent-coding-lite/TEMPLATE_HANDOFF.md
    5. agency-agents-lib/agents/<role>.md
    6. （可选）sprint contract
```

**关于 Telegram 上的 session mode**：
- `mode="session"` 需要 `thread=true`，仅 Discord 支持
- **Telegram 强制使用 `mode="run"`**，否则产生 zombie session

---

## 六、核心技能关系

```
┌─────────────────────────────────────────────────────────┐
│              dev-project-harness-loop                    │
│  【完整操作系统】：合同优先 + 守卫验证 + 持久记录        │
│  包含 autoloop + 包含 guards                             │
└──────────────────┬──────────────────────────────────────┘
                   │
         ┌─────────┴──────────┐
         ▼                     ▼
┌─────────────────┐  ┌──────────────────────────┐
│ dev-project-     │  │ project-harness-guards     │
│ autoloop         │  │ 【脚手架 + 守卫】           │
│ 【执行循环】      │  │ scripts/:                  │
│ bounded bet loop │  │   scaffold_harness.sh     │
│ verify oracle   │  │   run_change_guard.sh      │
│ commit/log      │  │   run_drift_check.sh      │
└─────────────────┘  └──────────────────────────┘

subagent-coding-lite ← 被 harness-dispatch 调用，按需注入 agency-agents-lib 角色
agency-agents-lib    ← 专业角色库（engineering 26个 + design 8个）
```

---

## 七、推荐 artifacts 结构

```
harness/
├── goal.md                    ← 最终目标、非目标、约束、审批边界
├── spec.md                    ← 扩展的产品/实现规格（需要时）
├── contracts/
│   └── sprint-<id>.md         ← sprint 合同 / definition of done
├── assignments/
│   └── assign-<id>.md         ← 标准化的 assignment brief
├── qa/
│   └── sprint-<id>.md         ← evaluator 验证报告
└── handoffs/
    └── handoff-<id>.md        ← session/subagent 交接

artifacts/                     ← 长日志、截图、trace
scripts/
├── run_change_guard.sh
└── run_drift_check.sh
```

---

## 八、最小可用流程

1. 写 `harness/goal.md`
2. 选 harness profile（`Solo` / `PG` / `PGE-final` / `PGE-sprint`）
3. 建 `harness/contracts/<sprint-id>.md`
4. 通过 `harness/assignments/<round-id>.md` 调度 bounded round
5. Builder 返回 evidence + handoff
6. Verifier 写 `harness/qa/<sprint-id>.md`
7. Planner reconcile，除非 blocked 不主动停

详见：`dev-project-harness-loop/references/minimal-flow-example.md`

---

## 九、Deployment Paths（安装路径对照表）

### 核心技能

| Repo 路径 | → 全局部署路径 |
|-----------|---------------|
| `dev-project-harness-loop/SKILL.md` | `/usr/local/lib/node_modules/openclaw/skills/dev-project-harness-loop/SKILL.md` |
| `dev-project-harness-loop/scripts/harness.js` | `/usr/local/lib/node_modules/openclaw/skills/dev-project-harness-loop/scripts/harness.js` |
| `dev-project-autoloop/SKILL.md` | `/usr/local/lib/node_modules/openclaw/skills/dev-project-autoloop/SKILL.md` |
| `project-harness-guards/SKILL.md` | `/usr/local/lib/node_modules/openclaw/skills/project-harness-guards/SKILL.md` |

### 扩展技能

| Repo 路径 | → 全局部署路径 |
|-----------|---------------|
| `subagent-coding-lite/SKILL.md` | `/usr/local/lib/node_modules/openclaw/skills/subagent-coding-lite/SKILL.md` |
| `subagent-coding-lite/TEMPLATE_*.md` | `/usr/local/lib/node_modules/openclaw/skills/subagent-coding-lite/TEMPLATE_*.md` |
| `harness-dispatch/SKILL.md` | `/usr/local/lib/node_modules/openclaw/skills/harness-dispatch/SKILL.md` |
| `harness-dispatch/references/` | `/usr/local/lib/node_modules/openclaw/skills/harness-dispatch/references/` |
| `agency-agents-lib/` | `/usr/local/lib/node_modules/openclaw/skills/agency-agents-lib/` |

### References

| Repo 路径 | → 全局部署路径 |
|-----------|---------------|
| `dev-project-harness-loop/references/*.md` | `.../skills/dev-project-harness-loop/references/*.md` |
| `subagent-coding-lite/references/*.md` | `.../skills/subagent-coding-lite/references/*.md` |

> **注意**：全局路径（`/usr/local/lib/node_modules/openclaw/skills/`）为权威运行时位置。Workspace 路径（`~/.openclaw/agents/<agent-id>/workspace/skills/`）不覆盖全局。全局永远优先。

---

## License

MIT
