---
name: project-harness-guards
description: Create or upgrade a project "harness" so long-running agents can make goal-closed progress with durable records and evidence. Use when starting a new agent-driven project, when a repo lacks CLAUDE.md/AGENTS.md/features.json/init.sh/CHANGELOG.md/tests, when progress claims need auditability, or when you need drift/change guards (run_drift_check.sh/run_change_guard.sh) before accepting milestones.
---

# Project Harness Guards

Build or upgrade a **project harness**: a structured repository layout + guard scripts that turn a long task into a verifiable, resumable state machine.

## Non‑negotiable outcome

A project has a harness only if it has **(1) durable records**, **(2) a verifiable oracle**, and **(3) a low-friction way to resume**.

## What “harness” means (minimum set)

A harness is the smallest set of files that allows:
- **read context fast** (map + rules)
- **persist progress** (state + log)
- **verify** (tests/oracles)
- **recover** (git commits + revert)

Minimum expected files (repo-local unless explicitly external):
- `CLAUDE.md` — mission + global constraints + acceptance target
- `AGENTS.md` — short index to truth sources (keep ~100 lines)
- `CHANGELOG.md` or `claude-progress.txt` — progress + failed attempts (must mention commit hashes)
- `features.json` — structured checklist with `passes: false|true`
- `init.sh` — idempotent environment bootstrap (+ optionally a smoke/e2e step)
- `docs/architecture.md` — dependency direction rules (mechanizable)
- `tests/` — at least one runnable oracle (unit/integration/e2e)
- `harness.json` — commands + paths + acceptance summary

If governance docs live outside the repo (e.g., Obsidian), add a pointer file:
- `HARNESS_LINKS.md` — repo ↔ record-root mapping

## Primary workflow

### 1) Scaffold or upgrade

Preferred: generate missing files without overwriting existing content.

- Use the bundled scaffold script:
  - `bash scripts/scaffold_harness.sh` (copy from this skill into the project)

If you are not allowed to copy scripts, create the same files manually.

### 2) Make the repo a state machine

- Treat **each meaningful bet** as a state transition.
- Require a commit per bet.
- Require the progress log to reference the commit (`commit: <hash>`).

### 3) Install guards

Copy these scripts into the project repo at `scripts/`:
- `run_drift_check.sh`
- `run_change_guard.sh`

Then enforce:
- after every meaningful change: update progress log + commit
- before any milestone claim: run `bash scripts/run_change_guard.sh` (optionally: `bash scripts/run_change_guard.sh <project-root>`)

## Guard semantics

- **Drift check**: validates the harness exists + progress log mentions HEAD commit.
- **Change guard**: drift check + run the best available test command.

If a guard fails:
- fix it, or
- explicitly record the risk acceptance in the progress log (never silently ignore).

## References

Read when you need details:
- `references/anthropic-effective-harnesses-mapping.md` (Anthropic 编排 → 三技能家族落地对照卡)
- `references/harness-layout.md`
- `references/task-log-format.md`
