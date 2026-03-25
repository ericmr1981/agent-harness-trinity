# Assignment Header for Dev Project Harness Loop

Use this header when delegating a project task to a coding agent, ACP session, sub-agent, or ClawTeam worker.

The goal is to make assignment quality high enough that the agent can operate autonomously **without drifting**.

## Assignment structure

### 1) Mission
- Project:
- Objective:
- Why this matters now:
- Mode: `feature` | `bugfix` | `refactor`

### 2) Acceptance target
- Done means:
- Required checks:
- Manual verification path:
- Evidence required in final response:

### 3) Read first
- `Map.md`
- `Harness_DoD.md`
- `ProjectTasks.md`
- additional repo files as needed

### 4) Scope and constraints
- In scope files/dirs:
- Out of scope:
- Non-goals:
- Do not perform without approval:

### 5) Execution rules
- Work in bounded reversible iterations
- Prefer simple diffs
- After each meaningful change, update repo-local execution docs (for example `docs/RUNLOG.md`, `docs/NEXT.md`, or the repo-local task log)
- If the assignment explicitly includes a repo-local `ProjectTasks.md`, update it too
- Keep / rework / revert after verification
- Do not claim done without guard evidence

### 6) Guard and evidence rules
Before claiming a milestone or completion:
- run `bash scripts/run_change_guard.sh "<project-record-root>"`
- include the raw guard output
- include the new `ProjectTasks.md` log entry
- include verification results

### 7) Stop conditions
Pause and escalate if:
- destructive action is needed
- credentials/billing/external side effects are required
- product choices are ambiguous
- repeated attempts fail without new evidence

### 8) Final response format
- Change summary
- Verification summary
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
Why now: <business or delivery reason>

# Acceptance
Done means:
- <observable outcome 1>
- <observable outcome 2>

Required checks:
- <test/build/lint/manual>

Evidence required in final response:
- verification results
- raw `run_change_guard.sh` output
- added `ProjectTasks.md` entry

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
- Update `ProjectTasks.md` after each meaningful change
- Keep / rework / revert after verification
- Do not claim done without guard evidence

# Stop Conditions
- destructive action
- credentials/external side effects
- ambiguous product direction
- repeated failures without new evidence

# Final Response
Include:
- change summary
- verification summary
- keep/rework/revert decision
- raw guard output
- ProjectTasks.md excerpt
- residual risk / next step
```

## ClawTeam-style guidance

Borrow these habits from ClawTeam assignments:
- give every worker a **single clear owner-style objective**
- define dependencies explicitly
- state the evidence expected at completion
- prefer narrow task boundaries over broad inspirational prompts
- monitor by outcomes and state transitions, not chatter

For multi-agent use:
- split tasks by ownership, not by vague subsystem labels
- encode blockers/dependencies explicitly
- require each worker to report both delivery status and verification evidence

## Writing style rules

A good assignment header is:
- concrete
- bounded
- acceptance-first
- evidence-first
- low-drama

A bad assignment header is:
- broad and motivational
- missing scope limits
- missing stop conditions
- missing verification requirements
- missing evidence contract
