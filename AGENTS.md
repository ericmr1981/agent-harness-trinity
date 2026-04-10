# AGENTS.md (index)

Keep this file short (~100 lines).

## Where to look
- Mission + global rules: CLAUDE.md
- Goal contract: harness/goal.md
- Current progress: CHANGELOG.md
- Structured checklist: features.json
- Bootstrap: init.sh
- Architecture rules: docs/architecture.md
- Quality/tech debt: docs/quality.md

## Commands
- **`/Kickoff <project>`**: Generate early-stage docs (PRD + architecture draft + ADR) and bootstrap goal/feature checklist.
- **`/harness <task>`**: Generate sprint contracts + dispatch plan for implementation work.

## Default loop
1) Read CLAUDE.md + harness/goal.md + CHANGELOG.md
2) Pick one bounded bet that most reduces distance to the final goal
3) Implement + verify
4) Commit + log (include commit hash)
5) Continue unless blocker / approval boundary / major pivot

<!-- LEARNINGS_BLOCK -->
## Learnings
_Last round entry auto-appended by harness.js. Edit inside the block only._

<!-- LEARNINGS_END -->
