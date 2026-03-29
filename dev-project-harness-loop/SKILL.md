---
name: dev-project-harness-loop
description: Dev project harness loop: contracts, role separation, verifiable oracles, change-guards, durable records. Use when the agent owns a repo end-to-end with auditability.
---

# Dev Project Harness Loop

This is the **project operating system**:
- `dev-project-autoloop` (bounded execution loop)
- `project-harness-guards` (scaffolding + drift/change guards)

## Non-negotiable rules

No harness evidence → no acceptance claim.

Accepted progress requires:
1) implementation change
2) verification evidence (oracle)
3) durable record updated
4) guard passes (or explicit risk acceptance recorded)

Also:
- **Final goal is the default stop point.** Do not stop merely because one stage or subtask finished.
- **Messages are for orchestration; artifacts are for truth.**
- **Builder does not self-accept.** Use a verifier/evaluator whenever risk or ambiguity justifies it.

## Step 0) Ensure the harness exists (initializer phase)

Minimum harness files (repo-local):
- `CLAUDE.md`, `AGENTS.md`, `features.json`, `CHANGELOG.md` (or `claude-progress.txt`), `init.sh`, `harness.json`, `tests/`

If missing:
- use `project-harness-guards` to scaffold
- copy guard scripts into the repo at `scripts/`:
  - `run_drift_check.sh`
  - `run_change_guard.sh`

If governance lives outside the repo (e.g., Obsidian), add `HARNESS_LINKS.md` that maps repo ↔ record-root.

## Step 1) Resume from repo truth

At session start, always:
- `git log` (recent commits)
- read `CHANGELOG.md` (last iteration + failures)
- inspect `features.json` for remaining `passes=false`
- run `bash init.sh` if environment may have drifted

## Step 2) Establish the Goal Contract

Before doing iterative execution, define the durable project frame.

Recommended path:
- `harness/goal.md` (template: `references/goal-contract-template.md`)

Minimum fields:
- final goal / acceptance target
- non-goals
- constraints
- approval boundaries
- stop conditions
- reporting mode

This contract exists to keep the loop **goal-closed** and avoid needless “phase complete, please confirm” interruptions.

## Step 2.5) Choose a harness profile (cost-aware)

Use the simplest profile that still meets acceptance.

Profiles:
- **Solo**: generator only + guards
- **PG**: planner + generator
- **PGE-final**: planner + generator + evaluator (evaluator runs once at end)
- **PGE-sprint**: planner + generator + evaluator per sprint (highest reliability, highest cost)

See: `references/harness-profiles.md`

## Step 3) Contract-first execution (recommended; required for evaluator runs)

Before implementing a chunk, define “done” as a **Sprint Contract**.

Artifacts (recommended paths):
- goal contract: `harness/goal.md`
- spec: `harness/spec.md` (if planner expanded the prompt)
- contract: `harness/contracts/<sprint-id>.md` (template: `references/sprint-contract-template.md`)
- assignment: `harness/assignments/<round-id>.md` (template: `references/assignment-header.md`)
- evaluator report (if used): `harness/qa/<sprint-id>.md` (template: `references/qa-report-template.md`)
- handoff (for session/subagent transfer): `harness/handoff.md` (template: `references/handoff-template.md`)
- long logs/screenshots/traces: `artifacts/`

If an evaluator exists, it must:
- review the contract before coding starts
- enforce hard thresholds (rubric) and fail the sprint if a critical criterion is below threshold

Rubric examples:
- `references/rubrics/frontend.md`
- `references/rubrics/fullstack.md`

## Step 3.5) Role and artifact discipline

Default roles:
- **Planner / Orchestrator** — chooses the next bounded task, maintains goal/task state, decides whether to continue
- **Builder / Generator** — implements the current bounded task
- **Verifier / Evaluator** — independently tests and judges against the contract
- **Researcher** (optional) — gathers external knowledge without changing product code

Single-writer rule:
- planner owns goal/task/assignment artifacts
- builder owns implementation handoff artifacts
- verifier owns QA artifacts

Do not use long agent-to-agent chats as the source of truth. Persist the facts in files.

## Step 4) Run bounded iterations

Per iteration:
1) baseline (current failure / current oracle signal)
2) pick one bounded bet that most reduces distance to the final goal
3) implement
4) verify (oracle ladder: L0 → L1 → L2)
5) decide keep / rework / revert
6) update durable artifacts
7) **commit + log** (include commit hash)
8) update state (flip `features.json` only after oracle passes)

## Step 5) Planner reconcile loop (required)

After each bounded round:
1) re-read the goal contract and current task truth
2) mark completed work done
3) record failed / partial work with evidence
4) pick the highest-priority unfinished task
5) decide whether to continue immediately

If meaningful unfinished work remains and no blocker / approval boundary / major pivot exists, launch the next round without asking the human.

## Step 6) Noise isolation rule (subagent to protect context)

Long-running work often fails because tool output (build logs, stack traces, e2e output) fills the main context window.

Default strategy:
- Use a **subagent** (see `subagent-coding-lite`) for high-output or code-heavy rounds.
- The main agent stays as the **orchestrator**: chooses the bet, defines acceptance, does final verification, runs guards, commits, and updates durable records.

Hard requirement:
- Long output goes under repo files (suggested: `artifacts/`), and the user-facing summary / `CHANGELOG.md` links to it.

## Step 7) Guard before milestone claims

Before claiming a milestone/completion:
- run: `bash scripts/run_change_guard.sh`
  - if no tests configured, set `harness.json:testCommand` or pass `--test "<cmd>"`

If guard fails:
- fix it, or
- explicitly record risk acceptance in `CHANGELOG.md` (never ignore)

## Step 8) “Ralph loop” completion check

Even after a guard passes, run the acceptance oracle one more time (especially L2 / e2e).

## Stop conditions

Pause and ask the human only if:
- deployment / destructive action is needed
- credentials / billing / external side effects are required
- product direction is ambiguous
- repeated attempts fail without new evidence
- a major strategy pivot is needed

## References

- `references/goal-contract-template.md`
- `references/assignment-header.md`
- `references/harness-profiles.md`
- `references/sprint-contract-template.md`
- `references/qa-report-template.md`
- `references/handoff-template.md`
- `references/minimal-flow-example.md` (最小可用示例：goal → contract → assignment → handoff → QA → reconcile)
- `references/rubrics/frontend.md`
- `references/rubrics/fullstack.md`
- `references/anthropic-effective-harnesses-mapping.md` (Anthropic 编排 → 三技能家族落地对照卡)
