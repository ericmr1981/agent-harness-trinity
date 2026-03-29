# harness-dispatch

**OpenClaw wrapper for /harness CLI** — Automatically score tasks, select agents, and spawn subagents with complete context injection.

> Part of agent-harness-trinity | https://github.com/ericmr1981/agent-harness-trinity

---

## 🎯 Purpose

Enable OpenClaw agents to dispatch tasks using the `/harness` command with full integration:
1. Execute harness.js via exec
2. Parse output for sessions_spawn parameters
3. Call sessions_spawn with complete context (方案 C)
4. Return session key to user

---

## 🚀 Usage

When user says:
- `/harness <task>`
- `使用 harness 创建任务 <task>`
- `自动创建 subagent 处理 <task>`
- `为 <project> 实现 <feature>`

**Example**:
```
用户：为 Pipi-go 实现移动端棋盘缩放功能

Agent: 🔍 Analyzing task...
       📊 Task Score: 3.2/5.0
       🤖 Selected Agent: engineering-frontend-developer
       🚀 Subagent spawned: session_1774792123903
       ✅ Task dispatched successfully!
```

---

## 📋 Implementation Steps

### Step 1: Detect harness request

```javascript
const userMessage = "<user message>";
const harnessPatterns = [
  /^\/harness\s+(.+)/i,
  /使用 harness(.+)/i,
  /自动创建 (subagent|任务)(.*)/i,
  /为 (.+?) 实现 (.+)/i
];

let taskDescription = null;
for (const pattern of harnessPatterns) {
  const match = userMessage.match(pattern);
  if (match) {
    taskDescription = match[2] || match[1];
    break;
  }
}

if (!taskDescription) {
  // Not a harness request, handle normally
  return;
}
```

### Step 2: Execute harness.js

```javascript
const HARNESS_SCRIPT = '/Users/ericmr/Documents/GitHub/agent-harness-trinity/dev-project-harness-loop/scripts/harness.js';

const { stdout, stderr } = await exec(`node ${HARNESS_SCRIPT} "${taskDescription}"`);

if (stderr) {
  console.error('harness.js error:', stderr);
  return;
}

console.log('harness.js output:', stdout);
```

### Step 3: Parse output

```javascript
// Extract key information from output
const scoreMatch = stdout.match(/Task Score: ([\d.]+)\/5\.0/);
const agentMatch = stdout.match(/Selected Agent: (\S+)/);
const sessionMatch = stdout.match(/Subagent spawned: (session_\d+)/);

const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
const agent = agentMatch ? agentMatch[1] : null;
const session = sessionMatch ? sessionMatch[1] : null;
```

### Step 4: Report to user

```javascript
const report = `
📊 **Task Score**: ${score}/5.0
${agent ? `🤖 **Agent**: ${agent}` : ''}
${session ? `🚀 **Session**: ${session}` : ''}

✅ Task dispatched successfully!
   Monitor: harness/assignments/
`;

await message.send({ to: channelId, message: report });
```

---

## 🔧 Context Injection (方案 C)

When harness.js spawns a subagent, it automatically injects:

```javascript
const attachments = [
  // 1. Harness flow
  'skills/dev-project-harness-loop/SKILL.md',
  
  // 2. Subagent spec
  'skills/subagent-coding-lite/SKILL.md',
  'skills/subagent-coding-lite/TEMPLATE_ASSIGNMENT.md',
  'skills/subagent-coding-lite/TEMPLATE_HANDOFF.md',
  
  // 3. Domain expertise (if agent selected)
  'skills/agency-agents-lib/agents/engineering/engineering-frontend-developer.md'
];
```

**Total**: 4-5 files, ~1500-2500 tokens

---

## 📁 File Locations

| File | Path |
|------|------|
| harness-dispatch SKILL.md | `/usr/local/lib/node_modules/openclaw/skills/harness-dispatch/SKILL.md` (global) |
| harness.js | `/usr/local/lib/node_modules/openclaw/skills/harness-dispatch/references/harness.js` |
| dev-project-harness-loop SKILL.md | `skills/dev-project-harness-loop/SKILL.md` |
| subagent-coding-lite | `skills/subagent-coding-lite/` |
| agency-agents-lib | `skills/agency-agents-lib/` |

---

## ✅ Acceptance Criteria

- [ ] Detects `/harness` commands
- [ ] Executes harness.js correctly
- [ ] Parses output accurately
- [ ] Reports results to user
- [ ] Subagent receives complete context (4-5 files)
- [ ] Works in OpenClaw environment

---

## 🧪 Testing

### Test 1: Frontend task
```
/harness 开发一个 React 数据表格组件，支持虚拟滚动

Expected:
- Score: 2.8-3.5
- Agent: engineering-frontend-developer
- Session: session_*
```

### Test 2: Backend task
```
/harness 设计一个用户认证 API，支持 JWT

Expected:
- Score: 3.0-4.0
- Agent: engineering-backend-architect
- Session: session_*
```

### Test 3: Simple task (no subagent)
```
/harness 修改默认端口号

Expected:
- Score: 1.5-2.5
- Decision: MAIN SESSION
- No subagent spawned
```

---

## 📊 Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Detection accuracy | >95% | harness commands detected / total |
| Parse accuracy | >90% | successful parses / total |
| User satisfaction | >4/5 | feedback ratings |
| Subagent success | 100% | sessions spawned / attempted |

---

## 🔮 Future Enhancements

1. **Direct sessions_spawn integration**: Instead of parsing output, call sessions_spawn directly from harness.js
2. **Multi-project coordination**: Track multiple projects simultaneously
3. **Progress monitoring**: Auto-check subagent progress and report
4. **Failure recovery**: Auto-retry failed subagents with different instructions

---

## 📄 License

MIT (part of agent-harness-trinity)
