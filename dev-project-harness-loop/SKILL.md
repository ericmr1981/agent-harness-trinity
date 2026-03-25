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

## Step 3) Run bounded autoloop iterations

Per iteration:
1) baseline (current failure / current oracle signal)
2) pick one bounded bet
3) implement
4) verify (oracle ladder: L0 → L1 → L2)
5) decide keep / rework / revert
6) **commit + log** (include commit hash)
7) update state:
   - flip `features.json` only after oracle passes

## Step 4) Record discipline (anti context-loss)

The repo must contain the durable record:
- `CHANGELOG.md` entry per iteration (include failures)
- each entry includes `commit: <sha>` and verification result

(Do not rely on chat history to remember what happened.)

## Step 5) Guard before milestone claims

Before claiming a milestone/completion:
- run: `bash scripts/run_change_guard.sh`
  - if no tests configured, set `harness.json:testCommand` or pass `--test "<cmd>"`

If guard fails:
- fix it, or
- explicitly record risk acceptance in `CHANGELOG.md` (never ignore).

## Step 6) “Ralph loop” completion check

Even after a guard passes, run the acceptance oracle one more time (especially L2/e2e).
This is to catch false-positive completion.

## Step 7) Reporting contract (user-facing)

Each bounded round produces:
- round goal / bet
- what changed
- verification result
- commit hash
- guard result
- next bet or blocker

## Stop conditions

Pause and ask the human if:
- deployment/destructive action is needed
- credentials/billing/external side effects are required
- product direction is ambiguous
- repeated attempts fail without new evidence
