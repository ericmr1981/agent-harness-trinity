# ACTIVE.md — Current WIP

> Repo-local source of truth for the next bounded bet.

## Current Project
- **Name**: agent-harness-trinity
- **Repo**: /Users/ericmr/Documents/GitHub/agent-harness-trinity
- **Objective**: Upgrade codemap.js to v3 — keep v2 anti-false-positive guarantees, then add cross-directory relationship visibility and role/layer classification so CodeMap becomes an actual execution map for skill/harness repos.
- **Status**: running
- **Started**: 2026-04-09 21:57 GMT+8

## Current Bet
- **Bet**: Implement CodeMap 3.0: role-map classification, document/script explicit cross-reference extraction, and durable record sync.
- **Why this bet**: v2 fixed correctness issues, but it still behaved like a navigation page instead of a working map for agent execution.

## Oracle
- `node --check dev-project-harness-loop/scripts/codemap.js`
- `node dev-project-harness-loop/scripts/codemap.js . --force --output harness/artifacts/codemap.md`
- `rg 'PATCH /path|Server Component' harness/artifacts/codemap.md` → must return nothing
- `rg '职责分层（Role Map）|跨目录引用（文档 / 脚本显式提及）' harness/artifacts/codemap.md`
- `bash scripts/run_drift_check.sh`
- `bash scripts/run_trinity_guard.sh`
- `bash init.sh`

## Result
- **Outcome**: in_progress
- **Current Blocker**: None
- **Stop Allowed**: no
- **Next Bet**: Finish record sync, run final guard, then decide whether to commit/push.

## Evidence
- codemap.js v3 now emits `roleLayers: 7` and `docCrossRefs: 30` in `codemap.meta.json`
- generated CodeMap now includes:
  - `## 职责分层（Role Map）`
  - `## 跨目录引用（文档 / 脚本显式提及）`
- false positives still remain eliminated (`PATCH /path` / fake `Server Component` absent)
- current working tree: `dev-project-harness-loop/scripts/codemap.js` modified only

## Files Touched This Round
- `dev-project-harness-loop/scripts/codemap.js`
- `harness/artifacts/codemap.md`
- `harness/artifacts/codemap.meta.json`
- `ACTIVE.md`

---
*Last updated: 2026-04-09 22:10 GMT+8*
