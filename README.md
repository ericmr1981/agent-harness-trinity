# Agent Harness Trinity

A small, opinionated toolkit for **goal-closed, long-running agent work**.

It bundles three OpenClaw skills that form a single “execution + governance” family:

- **dev-project-autoloop** — bounded-bet execution loop (commit/log/oracle-first)
- **project-harness-guards** — agent-first repo scaffolding + drift/change guards
- **dev-project-harness-loop** — the combined operating system (autoloop + guards)

Optional extension (does not change the core design):
- **subagent-coding-lite** — lightweight subagent dispatch for coding tasks (no-commit subagent + standardized acceptance + handoff packets)

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

Copy the skill folders into your agent’s skills directory.

Example (OpenClaw per-agent workspace):

```bash
cp -a dev-project-autoloop dev-project-harness-loop project-harness-guards \
  ~/.openclaw/agents/<agent-id>/workspace/skills/

# Optional extension:
cp -a subagent-coding-lite \
  ~/.openclaw/agents/<agent-id>/workspace/skills/
```

## License

MIT
