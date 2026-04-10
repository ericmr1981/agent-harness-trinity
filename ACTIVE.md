# ACTIVE.md — Current WIP

> Repo-local source of truth for the next bounded bet.

## Current Project
- **Name**: agent-harness-trinity
- **Repo**: /Users/ericmr/Documents/GitHub/agent-harness-trinity
- **Objective**: Apply the Minimal Ralph Upgrade without rewriting Trinity: make single-story dispatch the default, enforce split gates, auto-write learnings, and let feature acceptance criteria drive the oracle chain.
- **Status**: running
- **Started**: 2026-04-10 08:36 GMT+8

## Current Bet
- **Bet**: Batch 3 — let `features.json.acceptanceCriteria` drive the feature-specific oracle chain, so every selected story carries executable acceptance into continue-gate / contract / report.
- **Why this bet**: Batch 1 fixed story size discipline; Batch 2 fixed learning write-back; Batch 3 closes the acceptance gap so feature records become executable, not decorative.

## Oracle
- `node --check dev-project-harness-loop/scripts/harness.js`
- `node --check dev-project-harness-loop/scripts/context-assembler/context-assembler.js`
- `jq empty features.json`
- 临时 repo 副本注入待办 feature，非 dry-run 跑 harness，确认 `ACTIVE.md / contract / report` 都出现 feature-specific acceptance oracle

## Result
- **Outcome**: goal_closed
- **Current Blocker**: None
- **Stop Allowed**: yes
- **Next Bet**: Batch 4（待定）— 让 `--consume-result` 能按 feature id 自动回写 `features.json` 的 `passes/status`，闭合状态机。

## Evidence
- `acceptanceCriteria` 现在支持结构化对象（`id/title/verify/negativeTest/evidence`）并兼容旧字符串数组
- `buildFeatureOracle()` 会把 feature 级 `verify + acceptanceCriteria` 编译成 feature-specific `localOracle / finalOracle`
- `continueGate` / `masterBrief` / sprint contract / post-task report / CLI summary 都会显示 selected feature 与 acceptance 信息
- `ContextAssembler` 现在会在 unfinished feature 摘要中显示 `acceptanceCriteria` 数量
- 临时 repo 副本验证通过：真实生成的 `ACTIVE.md / harness/contracts/f-999.md / harness/reports/sprint-f-999-report.md` 已出现 feature oracle 内容

## Files Touched This Round
- `dev-project-harness-loop/scripts/harness.js`
- `dev-project-harness-loop/scripts/context-assembler/context-assembler.js`
- `features.json`
- `CHANGELOG.md`
- `ACTIVE.md`

---
*Last updated: 2026-04-10 09:46 GMT+8*
