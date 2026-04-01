# Assignment Header for Dev Project Harness Loop

Use this header when delegating a bounded round to a coding agent, ACP session, OpenClaw subagent, or ClawTeam worker.

The goal is to make the assignment precise enough that the worker can operate autonomously **without drifting** and return evidence that is easy to merge back into the main loop.

## Core rule

- **Messages notify. Artifacts decide.**
- The worker should receive the assignment in message form, but truth must live in repo artifacts.

## Assignment structure

### 1) Role
- Role: `planner` | `builder` | `verifier` | `researcher`
- Why this role was chosen now:

### 2) Mission
- Project:
- Round / sprint id:
- Objective:
- Why this matters now:
- Harness profile: `Solo` | `PG` | `PGE-final` | `PGE-sprint`

### 3) Goal + contract pointers
- Goal contract: `harness/goal.md`
- Spec (if used): `harness/spec.md`
- Sprint contract: `harness/contracts/<sprint-id>.md`
- Prior QA / handoff (if relevant):

If the contract is missing or not testable, stop and request a contract fix instead of guessing done.

### 4) Scope and constraints
- In scope files / dirs:
- Out of scope:
- Non-goals:
- Approval boundaries to respect:

### 5) Capabilities
State explicitly what the worker may do.

- Allowed tools / actions:
- Allowed code changes:
- Allowed verification commands:
- May browse / research externally: yes | no
- May edit product code: yes | no
- May edit harness docs: yes | no
- Must NOT commit / push / change remote state unless explicitly allowed

### 6) Acceptance target
- Final oracle (true completion condition):
- Done means (observable outcomes):
- Required checks (L1):
- User scenarios (L2): at least happy path + edge/error when user-visible
- Stop allowed before final oracle passes: yes | no
- Next forced bet if final oracle fails:
- Evidence required in final response:

### 7) Output contract
Return:
- files changed + why
- key diff summary
- verification evidence
- artifacts paths
- residual risks
- next-step recommendation

### 8) Escalation rule
Pause and escalate if:
- approval boundary is hit
- product direction is ambiguous
- repeated attempts fail without new evidence
- the contract conflicts with repo reality

## Short assignment template

```md
# Role
Role: <planner|builder|verifier|researcher>
Why now: <why this role is needed>

# Mission
Project: <name>
Round: <id>
Objective: <bounded target>
Harness profile: <Solo|PG|PGE-final|PGE-sprint>

# Goal + Contract Pointers
- Goal: harness/goal.md
- Spec: harness/spec.md
- Contract: harness/contracts/<sprint-id>.md
- Prior QA/Handoff: <paths>

# Scope
In scope:
- <paths>
Out of scope:
- <paths>
Non-goals:
- <explicit exclusions>
Approval boundaries:
- <actions that require escalation>

# Capabilities
Allowed tools/actions:
- <tools>
May browse externally: <yes|no>
May edit product code: <yes|no>
May edit harness docs: <yes|no>
Must not:
- git commit / git push / PR / remote changes
- scope expansion beyond contract

# Acceptance
Done means:
- <observable outcome 1>
- <observable outcome 2>

Required checks (L1):
- <lint/test/build>

User scenarios (L2):
- Scenario A (happy path):
  - Steps:
  - Expect:
- Scenario B (edge/error):
  - Steps:
  - Expect:

Evidence required:
- <logs/screenshots/paths>

# Output Contract
Return:
- files changed + why
- verification evidence
- artifacts paths
- residual risks
- next-step recommendation

# Escalate If
- approval boundary hit
- contract missing / ambiguous
- repeated attempts fail without new evidence
- two consecutive rounds on the same branch produce no meaningful new evidence (pivot and notify Boss; do not wait for confirmation unless approval boundary changes)
```

## Writing style rules

A good assignment header is:
- concrete
- bounded
- acceptance-first
- capability-explicit
- evidence-first

A bad assignment header is:
- broad and motivational
- missing scope limits
- missing verification requirements
- missing explicit capability boundaries
- missing an evidence contract
