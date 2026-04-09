# ACTIVE.md — Current WIP

> Repo-local source of truth for the next bounded bet.

## Current Project
- **Name**: agent-harness-trinity
- **Repo**: /Users/ericmr/Documents/GitHub/agent-harness-trinity
- **Objective**: Upgrade codemap.js to v2 — eliminate false positives in route/entry detection, add repo profile detection for skill/harness repos, add non-code key files section, and close the codemap audit with durable evidence.
- **Status**: running
- **Started**: 2026-04-09 21:13 GMT+8

## Current Bet
- **Bet**: Implement CodeMap 2.0: stripComments() anti-false-positive, repo profile detection, non-code files scanner, and update durable records.
- **Why this bet**: CodeMap was producing false API routes and false entry points, and was not useful for skill/harness repos which lack package.json-based framework detection.

## Oracle
- `node --check dev-project-harness-loop/scripts/codemap.js`
- `node dev-project-harness-loop/scripts/codemap.js . --force --output harness/artifacts/codemap.md`
- `rg 'PATCH /path|Server Component' harness/artifacts/codemap.md` → must return nothing (no false positives)
- `bash scripts/run_drift_check.sh`
- `bash scripts/run_trinity_guard.sh`
- `bash init.sh`

## Result
- **Outcome**: goal_closed
- **Current Blocker**: None
- **Stop Allowed**: yes
- **Next Bet**: Optional — push the codemap v2 commit to GitHub if Boss approves.

## Evidence
- codemap.js v2 generates: Routes found: 0 (was 1 false positive), Repo profile: multi-agent harness, Non-code key files: 14
- codemap.meta.json version 2 with repoProfile field
- All Trinity guards pass (drift / trinity_guard / init)
- `rg 'PATCH /path|Server Component' harness/artifacts/codemap.md` → no output (no false positives confirmed)

## Files Touched This Round
- `dev-project-harness-loop/scripts/codemap.js` (v2 rewrite)
- `harness/artifacts/codemap.md`
- `harness/artifacts/codemap.meta.json`
- `harness/artifacts/verification/`
- `CHANGELOG.md`
- `features.json`

---
*Last updated: 2026-04-09 21:21 GMT+8*
