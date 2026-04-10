# ACTIVE.md — Current WIP

> Repo-local source of truth for the next bounded bet.

## Current Project
- **Name**: agent-harness-trinity
- **Repo**: /Users/ericmr/Documents/GitHub/agent-harness-trinity
- **Objective**: Apply the Minimal Ralph Upgrade without rewriting Trinity: make single-story dispatch the default, enforce a split gate for oversized features, and then add lightweight learning write-back.
- **Status**: running
- **Started**: 2026-04-10 08:36 GMT+8

## Current Bet
- **Bet**: Batch 1 — implement B + C + minimal A: default one-story selection from `features.json`, block oversized stories with `split_required`, and teach ContextAssembler the upgraded feature queue shape.
- **Why this bet**: Trinity already has strong governance; the missing discipline is "one small story per round" rather than more orchestration.

## Oracle
- `node --check dev-project-harness-loop/scripts/harness.js`
- `node --check dev-project-harness-loop/scripts/context-assembler/context-assembler.js`
- `node dev-project-harness-loop/scripts/context-assembler/context-assembler.js . "pick next feature from features queue"`

## Result
- **Outcome**: goal_closed
- **Current Blocker**: None
- **Stop Allowed**: yes
- **Next Bet**: Batch 3 — 把 `features.json` 的 `acceptanceCriteria` 字段和 harness 的 oracle 体系打通，让每个 feature 自己带可执行验收路径。

## Evidence
- `harness.js` now reads `features.json` as a lightweight execution queue and prefers one runnable feature per round
- `split_required` is now a first-class stop outcome for oversized stories (`size=L`, explicit split status, or too many acceptance criteria)
- `ContextAssembler` now parses both array-root and object-root `features.json`
- validation passed for both modified scripts

## Files Touched This Round
- `dev-project-harness-loop/scripts/harness.js`
- `dev-project-harness-loop/scripts/context-assembler/context-assembler.js`
- `features.json`
- `CHANGELOG.md`
- `ACTIVE.md`
- `AGENTS.md`

---
*Last updated: 2026-04-10 01:08 GMT+8*
