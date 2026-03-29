# Subagent Coding Lite — Assignment Brief

Copy/paste and fill. Keep it tight.

## Role
- Role: `planner` | `builder` | `verifier` | `researcher`
- Why this role is needed now:
- Role charter (optional pointer): `references/role-charters.md`

## Agent Profile (Optional — for specialized tasks)
> Use when the task requires domain expertise (e.g., frontend, backend, security, UX).
> See: `skills/agency-agents-lib/SKILL.md` for available agents.

- Agent ID: `engineering-frontend-developer` | `engineering-backend-architect` | `design-ui-designer` | ...
- Agent File: `skills/agency-agents-lib/agents/<category>/<agent>.md`
- Inject as attachment: `yes` | `no`
- Why this agent: (brief explanation of why specialized expertise is needed)

**Example:**
```yaml
Agent ID: engineering-frontend-developer
Agent File: skills/agency-agents-lib/agents/engineering/engineering-frontend-developer.md
Inject as attachment: yes
Why this agent: Task requires React virtualization expertise for 1000+ row data table
```

## Goal
- Final goal pointer: `harness/goal.md`
- Bounded mission for this round:

## Repo / Path
- Repo root:
- Working branch (if any):

## Contract pointers
- Spec (if exists): `harness/spec.md`
- Sprint contract: `harness/contracts/<sprint-id>.md`
- Prior QA / handoff / relevant artifacts:

If the contract is missing or not testable, STOP and request a contract update instead of guessing done.

## Context
- Relevant files/dirs:
  - 
- Error logs / reproduction notes:
  - 

## Scope boundaries
### Do (Allowed)
- 

### Don’t (Forbidden)
- Do NOT run `git commit`, `git push`, create PRs, or modify remote state.
- Do NOT change gateway/runtime configuration.
- Do NOT expand scope beyond the contract/acceptance.
- (Verifier role) Do NOT change product code unless explicitly allowed; prefer reporting issues.

## Capabilities
State explicitly what this subagent may do.
- Allowed tools / actions:
- May browse externally: yes | no
- May edit product code: yes | no
- May edit harness docs: yes | no
- May run verification commands: yes | no

## Human interruption policy
- Do NOT ask for confirmation after a phase boundary.
- Escalate only for blocker, approval boundary, contract ambiguity, or repeated failure without new evidence.

## Acceptance (choose one)

### P0 (default)
- Lint: `<command>`
- Typecheck/build: `<command>`
- Unit tests (if present): `<command>`
- Minimal manual check:
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
4) Facts / Assessment / Recommendation sections
5) If role=`verifier`: verdict PASS/FAIL + evidence paths
6) Handoff Packet (use TEMPLATE_HANDOFF.md)
