# /harness CLI Integration

## Purpose

Enable OpenClaw agents to use the `/harness` command to automatically:
1. Score tasks
2. Select agents
3. Create harness artifacts
4. Spawn subagents with complete context injection

---

## Usage in OpenClaw

```markdown
/harness <task description>
```

### Examples

```
/harness 为 Pipi-go 实现移动端棋盘缩放功能
/harness 开发一个 React 数据表格组件，支持虚拟滚动
/harness 优化 Pipi-go 的性能，FPS 达到 60
```

---

## Implementation

### Step 1: Execute harness.js via exec

```javascript
const taskDescription = "<task from user>";
const harnessScript = "/Users/ericmr/Documents/GitHub/agent-harness-trinity/dev-project-harness-loop/scripts/harness.js";

const result = await exec(`node ${harnessScript} "${taskDescription}"`);
```

### Continue-gate / report flags (v5-preview)

Use these flags when the run needs to record a real blocked state or attach evidence into the report scaffold:

```bash
--blocked-external
--blocked-approval
--result-status "⚠️ partial"
--failure-type "L1"
--evidence-artifact "artifacts/test-failure-2026-04-01.log"
```

Examples:

```bash
node harness.js --blocked-external --result-status "🔴 blocked" --failure-type "L0" --evidence-artifact "artifacts/build-error.log" "修复构建失败"
node harness.js --blocked-approval --result-status "🔴 blocked" "部署到生产"
```

### Step 2: Parse output and extract sessions_spawn command

The harness.js output includes:
```
🔧 OpenClaw sessions_spawn command:
sessions_spawn({
  runtime: "subagent",
  task: `...`,
  label: "...",
  attachments: [...]
})
```

### Step 3: Execute sessions_spawn

Parse the command and call `sessions_spawn` with the extracted parameters.

---

## Complete Context Injection (方案 C)

When spawning a subagent, ALWAYS inject:

```javascript
const attachments = [
  // 1. Harness flow
  'skills/dev-project-harness-loop/SKILL.md',
  
  // 2. Subagent spec
  'skills/subagent-coding-lite/SKILL.md',
  'skills/subagent-coding-lite/TEMPLATE_ASSIGNMENT.md',
  'skills/subagent-coding-lite/TEMPLATE_HANDOFF.md',
  
  // 3. Domain expertise (if selected)
  'skills/agency-agents-lib/agents/<category>/<agent>.md'
];
```

---

## Integration with OpenClaw Tool System

### Option A: Call from main session

```javascript
// In OpenClaw agent
const { output } = await exec(`node /path/to/harness.js "${task}"`);

// Parse output for sessions_spawn command
const spawnMatch = output.match(/sessions_spawn\({[\s\S]*?}\)/);
if (spawnMatch) {
  // Extract and execute
  const spawnCommand = spawnMatch[0];
  // Evaluate or parse the command to get parameters
  // Then call sessions_spawn with those parameters
}
```

### Option B: Create a wrapper skill

Create `/Users/ericmr/.openclaw/skills/harness-dispatch/SKILL.md`:

```markdown
# harness-dispatch

Dispatch tasks using the /harness CLI with full OpenClaw integration.

## Usage

When user says:
- "/harness <task>"
- "使用 harness 创建任务 <task>"
- "自动创建 subagent 处理 <task>"

## Steps

1. Execute harness.js via exec
2. Parse output for sessions_spawn parameters
3. Call sessions_spawn with extracted parameters
4. Return session key to user
```

---

## Output Format

### Success
```
✅ Task dispatched successfully!
   Session: session_1774792123903
   Agent: engineering-frontend-developer
   Monitor: harness/assignments/
```

### Failure
```
❌ Error: <error message>
```

---

## Testing

```bash
# Standalone test
node dev-project-harness-loop/scripts/harness.js "开发一个 React 前端组件"

# OpenClaw integration test (in agent session)
/exec node /path/to/harness.js "开发一个 React 前端组件"
```

---

## Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Task scoring accuracy | >90% | TBD |
| Agent match accuracy | >85% | TBD |
| Subagent spawn success | 100% | TBD |
| Context injection complete | 100% | ✅ |

---

## Troubleshooting

### Issue: sessions_spawn not executing

**Cause**: harness.js running in standalone mode, not OpenClaw environment

**Solution**: 
1. Execute harness.js from within OpenClaw agent session
2. Parse output and manually call sessions_spawn
3. Or integrate harness.js as OpenClaw built-in command

### Issue: Agent not matching

**Cause**: Task description doesn't contain recognizable keywords

**Solution**: 
1. Add more keywords to AGENT_KEYWORDS in harness.js
2. Lower matching threshold
3. Use embedding-based matching instead of keywords

---

## Next Steps

- [ ] Create wrapper skill for OpenClaw
- [ ] Test with real OpenClaw sessions
- [ ] Add metrics tracking
- [ ] Integrate with OpenClaw Gateway as built-in command
