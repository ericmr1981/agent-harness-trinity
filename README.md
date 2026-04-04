# Agent Harness Trinity

> 将 Git 仓库变为可验证、可暂停、可回退的 AI agent 执行状态机

**Trinity** 是一套面向 OpenClaw agent 的项目执行框架，核心解决一个问题：
> 长线任务做到一半断了，再打开时 agent 丢失上下文、重复劳动、无法验证进度。

---

## 设计思路

### 核心观察

长线 agent 任务失败通常死在这几个地方：

| 死因 | 症状 | 根因 |
|------|------|------|
| 不可恢复 | 重开后 agent 问"我们刚才做到哪了" | 状态没有持久化到文件 |
| 不可验证 | agent 说"完成了"，实际上没跑通 | 没有外部 oracle |
| 目标发散 | 做了三小时，最后交付的东西不是要的 | 没有目标边界 |
| 自我认可 | agent 自己写代码自己验收 | Builder = Verifier，利益冲突 |
| 盲目继续 | oracle 失败后假装没看见继续跑 | 没有强制停止规则 |

### 核心解法

**把 Git 仓库当作持久化状态机。**

每做一个 bounded bet：
1. **写文件** — 工作记录在 repo 文件里，不是 prompt 上下文里
2. **跑 oracle** — 用外部系统验证，不是 agent 自我声明
3. **Commit** — 每个 bet 有可回退的安全保存点
4. **记录证据** — `artifacts/` 存原始输出，可被第三方审计
5. **Guard 检查** — milestone 前必须过 `run_change_guard.sh`

### Role 模型

| Role | 职责 | 谁来做 |
|------|------|--------|
| **Planner** | 拆任务、定优先级、写合同 | 主 agent |
| **Builder** | 实现 bounded bet | 主 agent 或 subagent |
| **Verifier** | 独立验收，必须不是 Builder | 独立 subagent 或 human |

**关键约束**：Builder 不验收自己的工作。Verifier 必须有独立证据。

### Anti-Pattern 禁止清单

- ❌ `curl ... && echo "PASS"` — 自己说自己 pass
- ❌ `grep "ok" output.txt` — 纯字符串匹配无外部裁判
- ❌ agent 说"我检查过了，没问题" — 自我认可
- ❌ 没有 negative test 的验收条件
- ❌ 关键 milestone 前不跑 guard

---

## 应用场景

### 场景 1：业务项目开发（PG / PGE-sprint）
```
Boss: "把我们那个 n8n workflow 重构一下"
  → /harness "重构 n8n workflow，增加定时触发和中文输出"
  → harness.js 自动发现项目、写合同、调度 subagent
  → 每个 sprint 结束有 Verifier 独立验收
  → 全程可回退、可 resume、可审计
```

### 场景 2：多 subagent 并行任务（Multi-Agent）
```
任务需要：前端 UI + 后端 API + 数据库迁移
  → 一个 Planner 拆成 3 个独立 sprint
  → 3 个 subagent 并行 build
  → Planner 收集 handoff、跑 guard、统一 commit
  → Boss 只看最终 milestone，不被中间过程打扰
```

### 场景 3：开源 skill 开发
```
目标：开发并发布一个新 skill 到 clawhub
  → Solo 模式，harness 保证每个 bet 可验收
  → guard 确保 skill 语法正确、文档完整
  → commit 即发布准备完成状态
```

### 场景 4：Bug 修复 + 回归验证
```
Bug 报告 → 写 test first → 修复 → oracle 验证 test 通过
  → negative test：故意破坏后 oracle 报错
  → 全程有 evidence artifact 可审计
```

---

## 安装方式

### 方式 1：安装到 Agent Workspace（推荐）

```bash
# 克隆仓库
git clone https://github.com/ericmr1981/agent-harness-trinity.git
cd agent-harness-trinity

# 安装核心技能（dev-project-harness-loop + autoloop + guards）
bash scripts/install_skills.sh --agent jarvis

# 安装完整套件（含 subagent-coding-lite）
bash scripts/install_skills.sh --agent jarvis --with-subagent-lite
```

安装后技能位于：`~/.openclaw/agents/<agent-id>/workspace/skills/`

### 方式 2：安装到全局 OpenClaw Skills（所有 agent 共享）

```bash
bash scripts/install_skills.sh --dest /usr/local/lib/node_modules/openclaw/skills/
```

### 方式 3：为新项目搭建 Harness

```bash
cd /path/to/your/project
bash /path/to/agent-harness-trinity/project-harness-guards/scripts/scaffold_harness.sh
# 生成：CLAUDE.md, AGENTS.md, features.json, init.sh, harness.json, docs/, tests/
```

---

## 更新方式

### 日常更新（推荐）

每次 Trinity repo 有新 commit 后，在**任意机器**运行一行：

```bash
cd /path/to/agent-harness-trinity
bash scripts/sync_skills.sh --sync
```

脚本自动：
1. 拉取 GitHub latest commit SHA
2. 对比本地每个 skill 文件的 SYNCTAG 版本
3. SHA 不同 → 从 GitHub raw 下载并注入新版本标签
4. 输出清晰对照表

### 选项说明

| 参数 | 作用 |
|------|------|
| `--dry-run` | 只看差异，不下载 |
| `--sync` | 检查并更新 |
| `--force` | 强制重写所有文件（含已同步的） |
| `--global` | 更新 npm 全局 skill 目录 |
| `--agent <name>` | 指定 agent workspace |

### 示例

```bash
# 查看哪些文件需要更新
bash scripts/sync_skills.sh --dry-run

# 检查 + 更新 workspace skills
bash scripts/sync_skills.sh --sync

# 强制更新所有文件（用于强制同步）
bash scripts/sync_skills.sh --sync --force

# 更新全局 skills
bash scripts/sync_skills.sh --sync --global
```

---

## 快速开始

### 1. 写 Goal Contract

在项目 `harness/goal.md` 写清楚：
- 最终目标是什么
- 什么算"完成了"
- 审批边界（谁在什么情况下需要确认）

### 2. 开 Sprint

在 `harness/contracts/` 写 sprint 合同，必须包含：
- L1 Oracle（工程验证命令，必须是外部可执行的）
- L2 Oracle（用户场景验证）
- **Negative test**：如果故意破坏这个功能，oracle 会报错吗？

### 3. 执行 Bet

按 bounded bet loop 执行：
```
选最高优先级任务 → 实现 → 跑 oracle → 记录 evidence → commit → 继续或停止
```

### 4. Guard 检查

里程碑前必须跑：
```bash
bash scripts/run_change_guard.sh
```

---

## 核心技能

| 技能 | 定位 |
|------|------|
| `dev-project-harness-loop` | 完整操作系统：合同优先 + 守卫验证 + 持久记录 |
| `dev-project-autoloop` | 执行循环：Bounded bet loop，commit/log/oracle-first |
| `project-harness-guards` | 脚手架 + 守卫：repo 初始化 + 变更守卫脚本 |
| `subagent-coding-lite` *(扩展)* | subagent 规范：标准化 assignment/handoff/verification |
| `harness-dispatch` *(扩展)* | 强制入口门卫：所有 subagent 调度必须走这里 |
| `agency-agents-lib` *(扩展)* | 专业角色库：30+ 工程/设计角色定义 |

---

## 文件结构

```
agent-harness-trinity/
├── CLAUDE.md                          ← 项目使命
├── dev-project-harness-loop/          ← 核心执行环路
│   ├── SKILL.md
│   ├── scripts/harness.js             ← /harness 命令引擎
│   └── references/
│       ├── sprint-contract-template.md ← 合同模板（含 Oracle 规则）
│       ├── qa-report-template.md      ← Verifier 报告模板
│       └── failure-recovery-protocol.md
├── dev-project-autoloop/              ← 执行循环
├── project-harness-guards/            ← 脚手架 + 守卫
│   └── scripts/
│       ├── scaffold_harness.sh        ← 生成完整 harness
│       ├── run_change_guard.sh        ← drift check + test
│       └── run_drift_check.sh         ← 必需文件检查
├── subagent-coding-lite/              ← subagent 调度规范
├── harness-dispatch/                  ← subagent 强制门卫
├── skills/agency-agents-lib/          ← 30+ 专业角色库
├── scripts/
│   ├── install_skills.sh              ← repo → workspace 同步
│   └── sync_skills.sh                 ← GitHub → 本地增量更新
└── tests/smoke.sh                     ← 冒烟测试
```

---

## 版本信息

- **稳定基线**：`harness.js v4`
- **预览轨道**：`v5 Continue Gate + Pivot`（已落地）
- **当前 commit**：`aa1c7a5`

---

## License

MIT
