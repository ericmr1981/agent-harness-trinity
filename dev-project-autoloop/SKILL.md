---
name: dev-project-autoloop
description: Run a software development project as an autonomous goal loop. Use when the user wants the agent to own progress on a coding project, iterate in bounded reversible bets, verify with real oracles, commit/log each step for resumability, and continue without asking after every micro-step. Prefer dev-project-harness-loop when the project also needs durable harness records, explicit contracts, or guardrails.
---

# Dev Project Autoloop

Run a project as a **bounded bet loop** that is resumable across context windows.

## Default posture

- Treat the **repo state** as truth, not chat memory.
- Treat the **final goal** as the default stop point, not the end of a subtask.
- Treat **verification oracles** as the judge.
- Treat **git commits** as save points.
- Interrupt the human only for: blocker, approval boundary, major pivot, or milestone-ready result.

## Startup protocol (every session)

1) Read **goal + constraints** (repo docs if present: `CLAUDE.md`, `AGENTS.md`).
2) Read **current state**:
   - `git log -n 20 --oneline` (or equivalent)
   - progress log: `CHANGELOG.md` / `claude-progress.txt`
   - if present: `features.json` (what is still `passes=false`)
3) Establish the project frame (briefly): target, acceptance oracle(s), non-goals, stop conditions, approval boundaries.

## The loop (repeat)

### 0) Baseline
Capture: branch/status + current failing behavior + current test/e2e signal.

### 1) Pick one bounded bet
Choose the unfinished task that most directly reduces distance to the final goal.

### 2) Implement
Prefer small, reviewable diffs.

### 3) Verify (oracle ladder)
Run the narrowest reliable oracle first, then broaden:
- L0: build/typecheck/lint
- L1: unit/integration
- L2: e2e / real user-path automation

### 4) Decide
- **keep** if acceptance probability improved with evidence
- **rework** if direction is right but execution is wrong
- **revert** if it didn’t improve outcomes or increased complexity

### 5) Persist (this is what makes it “long-running”)
After each meaningful bet:
- **commit** (save point)
- **log** a short entry (include the commit hash)

If you do not have a harness, create a lightweight `RUNLOG.md`.
If you do have a harness, prefer `CHANGELOG.md` + `features.json`.

### 6) Reconcile
After each round, update your view of the project:
- what is now complete
- what remains unfinished
- what new evidence changed the next-best task
- whether you should continue immediately

If meaningful unfinished work remains and no blocker / approval boundary exists, start the next bounded round without asking.

## “Ralph loop” (anti false-completion)

Before claiming a milestone or “done”:
1) re-run the acceptance oracle (ideally L2)
2) re-check repo cleanliness / regressions
3) if a harness guard exists (`scripts/run_change_guard.sh`), run it

If any of these fail, you are not done.

## Stop conditions (ask the human)

Pause when:
- destructive action or deployment is needed
- credentials/billing/external side effects are required
- product direction is ambiguous
- repeated attempts fail without new evidence

## If the project needs governance

If you observe missing harness pieces (no `CLAUDE.md`, no progress log, no oracle), switch to the parent workflow:
- `dev-project-harness-loop` (or scaffold with `project-harness-guards`).

## References

- `references/anthropic-effective-harnesses-mapping.md` (Anthropic 编排 → 三技能家族落地对照卡)
