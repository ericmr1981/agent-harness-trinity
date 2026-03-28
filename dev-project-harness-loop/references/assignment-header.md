# Assignment Header for Dev Project Harness Loop

Use this header when delegating a project task to a coding agent, ACP session, sub-agent, or ClawTeam worker.

The goal is to make assignment quality high enough that the agent can operate autonomously **without drifting**.

## Assignment structure

### 1) Mission
- Project:
- Objective:
- Why this matters now:
- Mode: `feature` | `bugfix` | `refactor`
- Harness profile: `Solo` | `PG` | `PGE-final` | `PGE-sprint`

### 2) Contract-first (required)
Before writing code, create a **Sprint Contract** that makes “done” testable.

- Recommended: create `harness/contracts/<sprint-id>.md`
- Use template: `references/sprint-contract-template.md`

If an Evaluator role is used, the evaluator must review the contract and require fixes before implementation begins.

### 3) Acceptance target
- Done means (observable outcomes):
- Required checks (L1):
- User scenarios (L2 Web UI): at least 2 (happy path + edge/permission/error)
  - scenario steps:
  - expected result:
- Change → Acceptance coverage map (each change item maps to verification + evidence):
- Evidence required in final response:

### 4) Harness artifacts (required)
- `harness/spec.md` (if planner expanded the prompt)
- `harness/contracts/<sprint-id>.md`
- `harness/qa/<sprint-id>.md` (if evaluator exists; template: `references/qa-report-template.md`)
- `harness/handoff.md` (only if doing a context reset / session handoff)
- `artifacts/` for long logs, screenshots, traces

### 5) Read first
- `Map.md`
- `Harness_DoD.md`
- `ProjectTasks.md`
- additional repo files as needed

### 6) Scope and constraints
- In scope files/dirs:
- Out of scope:
- Non-goals:
- Do not perform without approval:

### 7) Execution rules
- Work in bounded reversible iterations
- Prefer simple diffs
- After each meaningful change, update repo-local execution docs (for example `docs/RUNLOG.md`, `docs/NEXT.md`, or the repo-local task log)
- If the assignment explicitly includes a repo-local `ProjectTasks.md`, update it too
- Keep / rework / revert after verification
- Do not claim done without guard evidence

### 8) Guard and evidence rules
Before claiming a milestone or completion:
- run `bash scripts/run_change_guard.sh "<project-record-root>"`
- include the raw guard output (or store long output under `artifacts/` and link it)
- include the new `ProjectTasks.md` log entry
- include verification results

### 9) Stop conditions
Pause and escalate if:
- destructive action is needed
- credentials/billing/external side effects are required
- product choices are ambiguous
- repeated attempts fail without new evidence

### 10) Final response format
- Change summary
- Contract link + any contract deltas
- Verification summary:
  - L1 (engineering checks)
  - L2 (user scenarios) + outcome
- Evaluator verdict (PASS/FAIL) + top findings (if evaluator exists)
- Change → Acceptance coverage map (brief)
- Keep / rework / revert decision
- Guard output
- `ProjectTasks.md` excerpt
- Residual risk / next step

## Short assignment template

```md
# Mission
Project: <name>
Objective: <specific target>
Mode: <feature|bugfix|refactor>
Harness profile: <Solo|PG|PGE-final|PGE-sprint>
Why now: <business or delivery reason>

# Contract-first
Create: harness/contracts/<sprint-id>.md
- scope (in/out/non-goals)
- acceptance criteria (numbered)
- verification plan (L1 + L2 scenarios)
- evidence locations (artifacts/)
- pass/fail thresholds (rubric)

# Acceptance
Done means:
- <observable outcome 1>
- <observable outcome 2>

Required checks (L1):
- <lint/test/build>

User scenarios (L2 Web UI):
- Scenario A (happy path):
  - Steps: <click-by-click>
  - Expect: <what user sees>
- Scenario B (edge/permission/error):
  - Steps: <click-by-click>
  - Expect: <what user sees>

Change → Acceptance coverage map:
- Change item 1:
  - Verified by: <L1 check + L2 scenario>
  - Evidence: <screenshot/log/artifact>

# Harness artifacts
- harness/spec.md (if planner used)
- harness/contracts/<sprint-id>.md
- harness/qa/<sprint-id>.md (if evaluator used)
- artifacts/ (logs/screenshots/traces)

# Read first
- Map.md
- Harness_DoD.md
- ProjectTasks.md

# Scope
In scope:
- <paths>
Out of scope:
- <paths/choices>
Non-goals:
- <explicit exclusions>

# Execution Rules
- Work in bounded reversible iterations
- Prefer simple diffs
- Update ProjectTasks.md after each meaningful change
- Do not claim done without guard evidence

# Final Response
Include:
- change summary
- contract link
- verification summary
- evaluator verdict (if applicable)
- raw guard output
- ProjectTasks.md excerpt
- residual risk / next step
```

## Writing style rules

A good assignment header is:
- concrete
- bounded
- acceptance-first
- contract-first
- evidence-first

A bad assignment header is:
- broad and motivational
- missing scope limits
- missing verification requirements
- missing an explicit contract
- missing evidence contract
