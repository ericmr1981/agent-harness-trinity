# ACTIVE.md — Current WIP

> Repo-local source of truth for the next bounded bet.

## Current Project
- **Name**: agent-harness-trinity
- **Repo**: /Users/ericmr/Documents/GitHub/agent-harness-trinity
- **Objective**: Close the remaining local record drift after the v5-preview Continue Gate work, with special focus on the `codemap.js` cache statistic (`trackedSrcCount`) and repo truth sync.
- **Status**: running
- **Started**: 2026-04-09 20:30 GMT+8

## Current Bet
- **Bet**: Reproduce the `trackedSrcCount` mismatch, fix it in `dev-project-harness-loop/scripts/codemap.js`, re-run Trinity guards/smoke, and sync `ACTIVE.md` / `CHANGELOG.md` / `features.json`.
- **Why this bet**: Repo health checks were green, but durable records were stale and the codemap cache statistic was still suspected to be wrong.

## Oracle
- `node dev-project-harness-loop/scripts/codemap.js . --output harness/artifacts/codemap.md`
- `bash scripts/run_drift_check.sh`
- `bash scripts/run_trinity_guard.sh`
- `bash init.sh`
- `bash tests/smoke.sh`
- temp scaffold smoke via `project-harness-guards/scripts/scaffold_harness.sh --install-guards`
- temp git worktree clean/dirty codemap cache replay

## Result
- **Outcome**: goal_closed
- **Current Blocker**: None
- **Stop Allowed**: yes
- **Next Bet**: Optional only — commit/push the current local reconciliation if Boss wants the repo history updated immediately.

## Evidence
- `trackedSrcCount` was reproduced as incorrect (`135`) and fixed to tracked source count (`9`)
- clean worktree second codemap run skips correctly; dirty tracked source forces rebuild
- `bash scripts/run_drift_check.sh` → passed
- `bash scripts/run_trinity_guard.sh` → passed
- `bash init.sh` → passed
- `bash tests/smoke.sh` → passed
- temp scaffold smoke → passed
- durable logs: `harness/artifacts/verification/2026-04-09-codemap-and-guard-summary.md`

## Files Touched This Round
- `dev-project-harness-loop/scripts/codemap.js`
- `.gitignore`
- `ACTIVE.md`
- `CHANGELOG.md`
- `features.json`

---
*Last updated: 2026-04-09 20:43 GMT+8*
