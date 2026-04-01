# ACTIVE.md — OpenClaw + agent-harness-trinity 升级路线图

> Active design track | 2026-04-01

## Current Project
- **Name**: OpenClaw + agent-harness-trinity 升级路线图
- **Repo**: /Users/ericmr/Documents/GitHub/agent-harness-trinity
- **Record root**: /Users/ericmr/Documents/GitHub/Obsidian/项目/OpenClaw-Trinity-Project-OS
- **Task**: 将本次 continue-gate / pivot 纠偏推进为 Trinity 的 **v5-preview 实现**，把 round outcome / continue gate 字段落到 harness.js 与模板
- **Mode**: implementation
- **Status**: active
- **Next bet**: 继续把 v5-preview 从 scaffold 推到真实执行闭环：evidence delta 记录、两轮无新证据自动 pivot、blocked_external / blocked_approval 的真实判定
- **Oracle**:
  1. `harness.js` 产出 continue-gate 字段
  2. ACTIVE/report/contract 模板包含 finalOracle / roundOutcome / nextForcedBet
  3. dry-run smoke test 能跑通 v5-preview scaffold
- **Evidence**:
  - `dev-project-harness-loop/scripts/harness.js`
  - `dev-project-harness-loop/references/assignment-header.md`
  - `dev-project-harness-loop/references/failure-recovery-protocol.md`
  - `skills/harness-dispatch/SKILL.md`
  - `node dev-project-harness-loop/scripts/harness.js --mode minimal --dry-run "v5 continue gate smoke test"`

## Version
- Stable baseline: harness.js v4
- New version track: v5 Continue Gate + Pivot
- Current implementation state: v5-preview scaffold landed

---
*Last updated: 2026-04-01 23:01 GMT+8*
