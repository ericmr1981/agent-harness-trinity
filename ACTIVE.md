# ACTIVE.md — Current WIP

> Repo-local source of truth for the next bounded bet.

## Current Project
- **Name**: agent-harness-trinity
- **Repo**: /Users/ericmr/Documents/GitHub/agent-harness-trinity
- **Objective**: Keep Trinity usable in practice: document the reliable repo → runtime sync path so local workspace skills can be brought in line with repo updates without guesswork.
- **Status**: running
- **Started**: 2026-04-09 23:05 GMT+8

## Current Bet
- **Bet**: Add a documented one-liner sync command and usage notes into the repo (`README.md` + `HARNESS-INSTALL-GUIDE.md`).
- **Why this bet**: Boss asked for a repo-native, copy-pasteable way to sync GitHub updates into local runtime.

## Oracle
- `rg -n "一键同步到本地运行环境|sync_skills\.sh --sync|install_skills\.sh --agent jarvis --with-subagent-lite" README.md HARNESS-INSTALL-GUIDE.md`

## Result
- **Outcome**: goal_closed
- **Current Blocker**: None
- **Stop Allowed**: yes
- **Next Bet**: Optional — commit / push the docs update if Boss wants it tracked immediately.

## Evidence
- `README.md` now contains a recommended one-liner sync command under 更新方式
- `HARNESS-INSTALL-GUIDE.md` now explains what each step does and when to use dry-run
- local runtime sync path is explicitly documented: `git pull` → `sync_skills.sh --sync` → `install_skills.sh --agent jarvis --with-subagent-lite`

## Files Touched This Round
- `README.md`
- `HARNESS-INSTALL-GUIDE.md`
- `CHANGELOG.md`
- `ACTIVE.md`

---
*Last updated: 2026-04-09 23:07 GMT+8*
