---
name: project-harness-guards
description: Create or upgrade a project harness so long-running agents can make goal-closed progress with durable records and evidence. Use when starting a new agent-driven project, when a repo lacks CLAUDE.md/AGENTS.md/features.json/init.sh/CHANGELOG.md/tests, when progress claims need auditability, or when you need drift/change guards before accepting milestones.
---

# Project Harness Guards

Build or upgrade a **project harness**: a structured repository layout + guard scripts that turn long-running agent work into a verifiable, resumable state machine.

## Non-negotiable outcome

A project has a harness only if it has:
1) durable records
2) a verifiable oracle
3) a low-friction way to resume
4) a clear final goal / approval boundary frame

## What “harness” means (minimum set)

A harness is the smallest set of files that allows:
- **read context fast** (map + rules)
- **persist progress** (state + log)
- **verify** (tests / oracles)
- **recover** (git commits + revert)
- **stay goal-closed** (do not stop at arbitrary phase boundaries)

Minimum expected files (repo-local unless explicitly external):
- `CLAUDE.md` — mission + global constraints + acceptance target
- `AGENTS.md` — short index to truth sources (keep ~100 lines)
- `CHANGELOG.md` or `claude-progress.txt` — progress + failed attempts (must mention commit hashes)
- `features.json` — structured checklist with `passes: false|true`
- `init.sh` — idempotent environment bootstrap (+ optionally a smoke/e2e step)
- `docs/architecture.md` — dependency direction rules (mechanizable)
- `tests/` — at least one runnable oracle
- `harness.json` — commands + paths + acceptance summary

Recommended harness artifacts:
- `harness/goal.md` — final goal, non-goals, constraints, approval boundaries
- `harness/contracts/` — sprint contracts / definitions of done
- `harness/assignments/` — role-based assignment briefs (optional but recommended)
- `harness/qa/` — verifier / evaluator reports (optional but recommended)
- `harness/handoff.md` — short handoff for session/subagent transfer
- `artifacts/` — long logs, screenshots, traces

If governance docs live outside the repo (e.g., Obsidian), add a pointer file:
- `HARNESS_LINKS.md` — repo ↔ record-root mapping

## Primary workflow (repo-first)

### 1) Scaffold or upgrade

Preferred: generate missing files without overwriting existing content.

- Use the bundled scaffold script:
  - `bash scripts/scaffold_harness.sh`

If you are not allowed to copy scripts, create the same files manually.

### 2) Make the repo a state machine

- Treat **each meaningful bet** as a state transition.
- Require a commit per bet.
- Require the progress log to reference the commit (`commit: <hash>`).
- Require the project frame (`harness/goal.md`) to define what counts as done and what still requires human approval.

### 3) Install guards

Copy these scripts into the project repo at `scripts/`:
- `run_drift_check.sh`
- `run_change_guard.sh`

Then enforce:
- after every meaningful change: update progress log + commit
- before any milestone claim: run `bash scripts/run_change_guard.sh`

## Guard semantics

- **Drift check**: validates the harness exists + progress log mentions HEAD commit.
- **Change guard**: drift check + run the best available test command.

If a guard fails:
- fix it, or
- explicitly record the risk acceptance in the progress log (never silently ignore)

## Single-writer guidance

To avoid conflicting agent edits:
- planner / orchestrator owns goal + task + assignment artifacts
- builder owns implementation changes and implementation handoff notes
- verifier owns QA findings / pass-fail artifacts

This does not need heavy enforcement, but it should be the default design stance.

## Optional: external record-root governance pack (Obsidian-style)

If you maintain a separate “project record root” outside the repo (commonly an Obsidian
project directory with `Map.md`, `ProjectTasks.md`, `Harness_DoD.md`, `Summary.md`), use the
bundled **record-root pack** in:

- `record-root-pack/`

It includes:
- `record-root-pack/scripts/upgrade_existing_project.sh <record-root>`
- `record-root-pack/scripts/scaffold_project_harness.sh <record-root>`
- `record-root-pack/scripts/run_change_guard.sh <record-root>`

This pack is intentionally optional so the core Trinity stays repo-first.

## References

Read when you need details:
- `references/goal-contract-template.md`
- `references/harness-layout.md`
- `references/task-log-format.md`
- `references/anthropic-effective-harnesses-mapping.md` (Anthropic 编排 → 三技能家族落地对照卡)
- `record-root-pack/references/*` (GitHub gates, summary style, script notes, agent contract)
