# ACTIVE.md — Current WIP

> This file lives inside the project repo. TASKS.md is the only project index.

## Current Project
- **Name**: agent-harness-trinity
- **Repo**: /Users/ericmr/Documents/GitHub/agent-harness-trinity
- **Task**: Round 2 完成，Round 3 待执行
- **Mode**: llm
- **Started**: 2026-04-11T10:21:36.099Z (initial F-003)
- **Status**: running
- **Sprints**: sprint-1

## Completed Rounds
- **Round 1** (`af211f3`): 索引与项目宪章收口（CLAUDE.md → goal.md、TASKS.md 替代 WORKSPACE.md）
- **Round 2** (`82dc133`): 四维评分 + ContextAssembler profile 门控（已 push）
  - 四维评分：scope/coordination/context/risk 各 1-10
  - context profile：minimal/standard/full（按需而非按 complexity）
  - attachment tier 跟随 context profile
  - ContextAssembler：section 分级（required/conditional/on-demand）+ .json 元数据
  - `parseTASKS` 支持 vNext 表格格式
  - 验证：smoke + regressions 全通过

## Round 3 待办（记录于 CHANGELOG）
1. `buildAttachments`：按 attachmentTier（minimal/standard/full）生成差异化附件
2. `buildMasterBrief`：新增 `## Planning Signals` + `## Context Profile` section
3. `printReport`：输出改为 Context Profile + Planning Signals
4. `--continue` 模式：自动从 `harness/context/` 读取 context-package + registry
5. ContextAssembler `--include-handoffs` on-demand flag

## Master Brief
最新：harness/assignments/master-brief-*.md（Round 2 产物）

## Version
harness.js v5-preview | per-project ACTIVE.md | TASKS.md index | ContextAssembler v2

---
*Last updated: 2026-04-11T10:27:00.000Z*
