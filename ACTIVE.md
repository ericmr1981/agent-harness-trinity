# ACTIVE.md — OpenClaw + agent-harness-trinity 升级路线图

> Active design track | 2026-04-01

## Current Project
- **Name**: OpenClaw + agent-harness-trinity 升级路线图
- **Repo**: /Users/ericmr/Documents/GitHub/agent-harness-trinity
- **Record root**: /Users/ericmr/Documents/GitHub/Obsidian/项目/OpenClaw-Trinity-Project-OS
- **Task**: 将本次 continue-gate / pivot 纠偏推进为 Trinity 的 **v5-preview 实现**，把 round outcome / continue gate 字段落到 harness.js 与模板
- **Mode**: implementation
- **Status**: active
- **Next bet**: 如果继续，会把 v5-preview 的 report scaffold 推到自动回填/消费链，而不是只靠 CLI 输入；并考虑把 evidence artifact 与 harness/artifacts 结构对齐
- **Oracle**:
  1. `harness.js` 真实输出 continue-gate 字段
  2. 同任务跨轮运行时会出现 `evidenceDelta` / `noEvidenceRounds` 变化
  3. 第 3 次同分支无新证据运行触发 `pivot_required`
  4. `--blocked-external` / `--blocked-approval` 能真实产出对应 round outcome
- **Evidence**:
  - `dev-project-harness-loop/scripts/harness.js`
  - `dev-project-harness-loop/SKILL-CLI.md`
  - `node dev-project-harness-loop/scripts/harness.js --mode minimal --dry-run "v5 pivot smoke test"`
  - `node dev-project-harness-loop/scripts/harness.js --mode minimal --dry-run --blocked-approval --result-status "🔴 blocked" --failure-type "L0" --evidence-artifact "artifacts/build.log" "deploy production"`
  - `node dev-project-harness-loop/scripts/harness.js --mode minimal --dry-run --blocked-external --result-status "🔴 blocked" --failure-type "L2" --evidence-artifact "artifacts/render-timeout.log" "probe render outage"`

## Version
- Stable baseline: harness.js v4
- New version track: v5 Continue Gate + Pivot
- Current implementation state: v5-preview runtime stop/pivot/blocker inputs landed

---
*Last updated: 2026-04-01 23:24 GMT+8*
