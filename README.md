# Agent Harness Trinity

A small, opinionated toolkit for **goal-closed, long-running agent work**.

It bundles three OpenClaw skills that form a single “execution + governance” family:

- **dev-project-autoloop** — bounded-bet execution loop (commit/log/oracle-first)
- **project-harness-guards** — agent-first repo scaffolding + drift/change guards
- **dev-project-harness-loop** — the combined operating system (autoloop + guards)

Optional extension (does not change the core design):
- **subagent-coding-lite** — lightweight subagent dispatch for coding tasks (subagent does *not* commit; main agent merges + verifies)

## Why this exists

Long tasks fail in practice because progress is not:

- resumable (state not persisted)
- verifiable (no oracle)
- reversible (no safe save points)

This repo treats a **Git repo as a persistent state machine** and enforces:

- small reversible bets
- explicit verification oracles
- commit-linked progress logs
- guard scripts before milestone claims

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

## License

MIT
