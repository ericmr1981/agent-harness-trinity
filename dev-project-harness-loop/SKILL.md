---
name: dev-project-harness-loop
description: Run a software development project with autonomous forward progress plus harness governance: scaffold/upgrade agent-first repo structure (CLAUDE.md, AGENTS.md, features.json, init.sh, progress log), treat git as a persistent state machine, require verifiable oracles, and block milestone claims unless change guards pass and records are updated. Use when you want the agent to take over a project end-to-end and keep it auditable and resumable.
---

# Dev Project Harness Loop

This is the **project operating system**:
- `dev-project-autoloop` (bounded execution loop)
- `project-harness-guards` (scaffolding + drift/change guards)

## Non‑negotiable rule

No harness evidence → no acceptance claim.

Accepted progress requires:
1) implementation change
2) verification evidence (oracle)
3) durable record updated (progress log + task state)
4) guard passes (or explicit risk acceptance recorded)

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

## Step 2) Establish the project frame

Define briefly:
- target outcome
- acceptance oracles (L2 preferred for final)
- non-goals
- stop conditions
- smallest reversible iteration unit

### Acceptance discipline (Web UI default)

To prevent “looks done but isn’t user-done”, acceptance must be **two-layered**:
- **L1 (engineering checks)**: lint/test/build/smoke
- **L2 (user acceptance)**: simulate real user paths in the Web UI (manual steps or automated e2e)

Minimum L2 requirements (unless explicitly out-of-scope):
- at least **2 user scenarios**: 1× happy path + 1× edge/permission/error path
- maintain a short **Change → Acceptance coverage map**
- evidence must be reproducible: commands + URLs/steps + screenshots/log excerpts (store long output under `artifacts/`)

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
- contract: `harness/contracts/<sprint-id>.md` (template: `references/sprint-contract-template.md`)
- evaluator report (if used): `harness/qa/<sprint-id>.md` (template: `references/qa-report-template.md`)
- handoff (only for context reset / session change): `harness/handoff.md` (template: `references/handoff-template.md`)
- long logs/screenshots/traces: `artifacts/`

If an evaluator exists, it must:
- review the contract before coding starts
- enforce hard thresholds (rubric) and fail the sprint if a critical criterion is below threshold

Rubric examples:
- `references/rubrics/frontend.md`
- `references/rubrics/fullstack.md`

## Step 4) Run bounded iterations

Per iteration:
1) baseline (current failure / current oracle signal)
2) pick one bounded bet
3) implement
4) verify (oracle ladder: L0 → L1 → L2)
5) decide keep / rework / revert
6) **commit + log** (include commit hash)
7) update state (flip `features.json` only after oracle passes)

## Step 5) Record discipline (anti context-loss)

The repo must contain the durable record:
- `CHANGELOG.md` entry per iteration (include failures)
- each entry includes `commit: <sha>` and verification result

### Noise isolation rule (subagent to protect context)

Long-running work often fails because tool output (build logs, stack traces, e2e output) fills the main context window.

Default strategy:
- Use a **subagent** (see `subagent-coding-lite`) for high-output rounds.
- The main agent stays as the **orchestrator**: chooses the bet, sets acceptance oracles, and does final verification + guards + commit/log.

Hard requirement:
- Long output goes under repo files (suggested: `artifacts/`), and the user-facing summary/`CHANGELOG.md` links to it.

## Step 6) Guard before milestone claims

Before claiming a milestone/completion:
- run: `bash scripts/run_change_guard.sh`
  - if no tests configured, set `harness.json:testCommand` or pass `--test "<cmd>"`

If guard fails:
- fix it, or
- explicitly record risk acceptance in `CHANGELOG.md` (never ignore)

## Step 7) “Ralph loop” completion check

Even after a guard passes, run the acceptance oracle one more time (especially L2/e2e).

## Stop conditions

Pause and ask the human if:
- deployment/destructive action is needed
- credentials/billing/external side effects are required
- product direction is ambiguous
- repeated attempts fail without new evidence

## References

- `references/assignment-header.md` (delegation assignment header: acceptance/contract/evidence-first)
- `references/harness-profiles.md`
- `references/sprint-contract-template.md`
- `references/qa-report-template.md`
- `references/handoff-template.md`
- `references/rubrics/frontend.md`
- `references/rubrics/fullstack.md`
- `references/anthropic-effective-harnesses-mapping.md` (Anthropic 编排 → 三技能家族落地对照卡)
