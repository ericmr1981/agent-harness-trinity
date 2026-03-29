# /harness 安装指南

## 📦 安装状态

### ✅ 已安装到全局

| Skill | 位置 | 状态 |
|------|------|------|
| **harness-dispatch** | `/usr/local/lib/node_modules/openclaw/skills/harness-dispatch/` | ✅ 已安装 |
| harness.js | `/usr/local/lib/node_modules/openclaw/skills/harness-dispatch/references/harness.js` | ✅ 已安装 |

### ✅ 已安装到 Agent Workspace

| Skill | 位置 | 状态 |
|------|------|------|
| dev-project-harness-loop | `~/.openclaw/agents/jarvis/workspace/skills/` | ✅ 已安装 |
| subagent-coding-lite | `~/.openclaw/agents/jarvis/workspace/skills/` | ✅ 已安装 |
| agency-agents-lib | `~/.openclaw/agents/jarvis/workspace/skills/` | ✅ 已安装 |
| harness-dispatch | `~/.openclaw/agents/jarvis/workspace/skills/` | ✅ 已安装 |

---

## 🔧 harness-dispatch 功能

### 作用
**OpenClaw 和 /harness CLI 之间的"翻译官"**

### 工作流程
```
用户：/harness 开发一个 React 组件
   ↓
harness-dispatch:
  1. 识别 /harness 命令
  2. 执行 harness.js
  3. 解析输出（评分、Agent、session）
  4. 调用 sessions_spawn 创建 subagent
  5. 注入完整上下文（方案 C）
   ↓
用户：✅ Subagent spawned: session_xxx
```

---

## 🚀 使用方式

### 方式 1: OpenClaw 中直接使用（推荐）

```markdown
用户：/harness 开发一个 React 数据表格组件

Agent: 🔍 Analyzing task...
       📊 Task Score: 3.2/5.0
       🤖 Selected Agent: engineering-frontend-developer
       🚀 Subagent spawned: session_1774792123903
       ✅ Task dispatched successfully!
```

### 方式 2: 直接运行 CLI

```bash
node /usr/local/lib/node_modules/openclaw/skills/harness-dispatch/references/harness.js "开发一个 React 组件"
```

---

## ⚠️ 注意事项

### OpenClaw 重启
如果 `openclaw skills list` 看不到 harness-dispatch，需要重启 Gateway：

```bash
openclaw gateway restart
```

**注意**：Gateway 重启需要用户确认！

### 验证安装

```bash
# 检查全局 skill 是否存在
ls -la /usr/local/lib/node_modules/openclaw/skills/harness-dispatch/

# 检查 harness.js 是否存在
ls -lh /usr/local/lib/node_modules/openclaw/skills/harness-dispatch/references/harness.js

# 检查 OpenClaw 是否识别
openclaw skills list 2>&1 | grep harness-dispatch
```

---

## 📋 完整依赖清单

/harness 命令需要以下 skill 全部安装：

1. ✅ **harness-dispatch** (全局) - OpenClaw wrapper
2. ✅ **harness.js** (全局) - CLI 主脚本
3. ✅ **dev-project-harness-loop** (workspace) - Harness 流程
4. ✅ **subagent-coding-lite** (workspace) - Subagent 规范
5. ✅ **agency-agents-lib** (workspace) - 领域专业知识

---

## 🧪 测试命令

```bash
# 测试 CLI 直接运行
node /usr/local/lib/node_modules/openclaw/skills/harness-dispatch/references/harness.js "开发一个 React 前端组件"

# 在 OpenClaw 中测试（重启后）
/harness 开发一个 React 前端组件
```

---

## 📊 预期输出

```
🔍 Analyzing task: 开发一个 React 前端组件
🆕 Creating new project...
📊 Task Score: 3.2/5.0
   Decision: SUBAGENT + SPECIALIZED AGENT
🤖 Selected Agent: engineering-frontend-developer
   Confidence: 50%
   Category: engineering
📝 Creating harness artifacts...
   ✓ harness/goal.md
   ✓ harness/contracts/sprint-1774792xxx.md
   ✓ harness/assignments/assign-1774792xxx.md
🚀 Spawning subagent...
📦 Injecting 5 skills:
   - skills/dev-project-harness-loop/SKILL.md
   - skills/subagent-coding-lite/SKILL.md
   - skills/subagent-coding-lite/TEMPLATE_ASSIGNMENT.md
   - skills/subagent-coding-lite/TEMPLATE_HANDOFF.md
   - skills/agency-agents-lib/agents/engineering/engineering-frontend-developer.md
✅ Subagent spawned: session_1774792xxx
```

---

## 🔮 下一步

1. **重启 OpenClaw Gateway**（如果需要）
2. **测试 /harness 命令**
3. **监控指标**（成功率、Agent 匹配准确率等）

---

## 📄 相关文档

- [SKILL-CLI.md](dev-project-harness-loop/SKILL-CLI.md) - OpenClaw 集成指南
- [failure-recovery-protocol.md](dev-project-harness-loop/references/failure-recovery-protocol.md) - 失败恢复协议
- [auto-resume-protocol.md](dev-project-harness-loop/references/auto-resume-protocol.md) - Auto-Resume 协议

---

**安装完成日期**: 2026-03-29  
**版本**: v0.1.0
