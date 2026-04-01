# ACTIVE.md — OpenClaw + agent-harness-trinity 升级路线图

> Active design track | 2026-04-01

## Current Project
- **Name**: OpenClaw + agent-harness-trinity 升级路线图
- **Repo**: /Users/ericmr/Documents/GitHub/agent-harness-trinity
- **Record root**: /Users/ericmr/Documents/GitHub/Obsidian/项目/OpenClaw-Trinity-Project-OS
- **Task**: 将本次 continue-gate / pivot 纠偏推进为 Trinity 的 **v5-preview 实现**，把 round outcome / continue gate 字段落到 harness.js 与模板
- **Mode**: implementation
- **Status**: active
- **Next bet**: 继续把 v5-preview 从局部 runtime 判定推进到完整闭环：`blocked_external` / `blocked_approval` 真判定、evidence artifact 挂接、post-task report 回填链路
- **Oracle**:
  1. `harness.js` 真实输出 continue-gate 字段
  2. 同任务跨轮运行时会出现 `evidenceDelta` / `noEvidenceRounds` 变化
  3. 第 3 次同分支无新证据运行触发 `pivot_required`
- **Evidence**:
  - `dev-project-harness-loop/scripts/harness.js`
  - `dev-project-harness-loop/references/assignment-header.md`
  - `dev-project-harness-loop/references/failure-recovery-protocol.md`
  - `skills/harness-dispatch/SKILL.md`
  - `node dev-project-harness-loop/scripts/harness.js --mode minimal --dry-run "v5 pivot smoke test"`

## Version
- Stable baseline: harness.js v4
- New version track: v5 Continue Gate + Pivot
- Current implementation state: v5-preview runtime pivot logic landed

---
*Last updated: 2026-04-01 23:17 GMT+8*
