# Subagent Coding Lite — Assignment Brief

Copy/paste and fill. Keep it tight.

## Role
- Role: `planner` | `generator` | `evaluator` (default: `generator`)
- Harness profile: `Solo` | `PG` | `PGE-final` | `PGE-sprint` (optional)

## Goal
- 

## Repo / Path
- Repo root:
- Working branch (if any):

## Contract-first (when applicable)
If this task is part of a sprinted harness run, the following artifacts apply.
- Spec (if exists): `harness/spec.md`
- Sprint contract (must exist before implementation for evaluator runs): `harness/contracts/<sprint-id>.md`
- QA report (evaluator role): `harness/qa/<sprint-id>.md`
- Handoff (only if context reset/session change): `harness/handoff.md`

If the contract is missing or not testable, STOP and request a contract update instead of “guessing done”.

## Context
- Relevant files/dirs:
  - 
- Error logs / reproduction notes:
  - 

## Do (Allowed)
- 

## Don’t (Forbidden)
- Do NOT run `git commit`, `git push`, create PRs, or modify remote state.
- Do NOT change gateway/runtime configuration.
- Do NOT expand scope beyond the contract/acceptance.
- (Evaluator role) Do NOT change product code unless explicitly allowed; prefer reporting issues.

## Acceptance (choose one)

### P0 (default)
- Lint: `<command>`
- Typecheck/build: `<command>`
- Unit tests (if present): `<command>`
- Minimal manual check (L2 if user-visible):
  - Scenario A (happy path):
  - Scenario B (edge/error/permission):

### P1 (high-risk changes)
Everything in P0, plus ONE critical e2e/spec:
- E2E: `<command>`

## Evidence / artifacts
- Long/noisy output MUST go under `artifacts/` (create if needed).
  - Example: `artifacts/subagent-build-log.txt`
- If screenshots/traces exist, store them under `artifacts/screenshots/` or `artifacts/traces/`.

## Output contract (what you must return)
Return:
1) Files changed + why (bullet list)
2) Key diff summary (3-10 bullets)
3) Verification evidence (commands + short results + links to `artifacts/*`)
4) If role=`evaluator`: verdict PASS/FAIL + link to `harness/qa/<sprint-id>.md`
5) Handoff Packet (use TEMPLATE_HANDOFF.md)
