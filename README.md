# Agent Harness Trinity

A small, opinionated toolkit for **goal-closed, long-running agent work**.

It bundles three OpenClaw skills that form a single “execution + governance” family:

- **dev-project-autoloop** — bounded-bet execution loop (commit/log/oracle-first)
- **project-harness-guards** — agent-first repo scaffolding + drift/change guards
- **dev-project-harness-loop** — the combined operating system (autoloop + guards + contract-first governance)

Optional extension (does not change the core design):
- **subagent-coding-lite** — lightweight subagent dispatch with standardized assignment, handoff, and verification contracts

## Why this exists

Long tasks fail in practice because progress is not:

- resumable (state not persisted)
- verifiable (no oracle)
- reversible (no safe save points)
- goal-closed (work stops at a phase boundary instead of the final objective)

This repo treats a **Git repo as a persistent state machine** and enforces:

- small reversible bets
- explicit verification oracles
- commit-linked progress logs
- guard scripts before milestone claims
- structured artifacts for planner / builder / verifier handoff
- milestone-only human interruption by default

## Design stance

- **Final goal is the default stop point.** Do not pause just because a subtask finished.
- **Conversation is for orchestration; artifacts are for truth.**
- **Verification beats optimism.** Builder does not self-accept.
- **Subagents are execution workers, not autonomous governors.** Main agent owns final verification, guards, commit discipline, and durable records.

## Install (local)

### Option A (recommended): installer script

```bash
bash scripts/install_skills.sh --agent <agent-id>
# optional:
bash scripts/install_skills.sh --agent <agent-id> --with-subagent-lite
```

### Option B: manual copy

```bash
cp -a dev-project-autoloop dev-project-harness-loop project-harness-guards \
  ~/.openclaw/agents/<agent-id>/workspace/skills/

# Optional extension:
cp -a subagent-coding-lite \
  ~/.openclaw/agents/<agent-id>/workspace/skills/
```

## Guard scripts (in your target project repo)

When `project-harness-guards` is installed into a target project repo (under `scripts/`):

- Drift check:
  - `bash scripts/run_drift_check.sh`
  - or `bash scripts/run_drift_check.sh <project-root>`
- Change guard:
  - `bash scripts/run_change_guard.sh`
  - or `bash scripts/run_change_guard.sh <project-root> --test "<cmd>"`

## Core artifacts (recommended)

- `harness/goal.md` — final goal, non-goals, constraints, approval boundaries
- `harness/spec.md` — expanded product / implementation spec when planning is needed
- `harness/contracts/<sprint-id>.md` — sprint contract / definition of done
- `harness/assignments/<round-id>.md` — standardized assignment brief
- `harness/qa/<sprint-id>.md` — evaluator / verifier report
- `harness/handoff.md` — short session/subagent handoff
- `artifacts/` — long logs, screenshots, traces

## Minimal operating flow

1. Write `harness/goal.md`
2. Choose a profile (`Solo` / `PG` / `PGE-final` / `PGE-sprint`)
3. Create `harness/contracts/<sprint-id>.md`
4. Dispatch a bounded round with `harness/assignments/<round-id>.md`
5. Builder returns evidence + handoff
6. Verifier writes `harness/qa/<sprint-id>.md`
7. Planner reconciles and continues unless blocked

See: `dev-project-harness-loop/references/minimal-flow-example.md`

## License

MIT
