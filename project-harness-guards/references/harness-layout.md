# Harness layout (agent-first)

## Goal

Make the repo itself the agent’s resumable operating environment.

## Suggested tree

```
/project
├── CLAUDE.md                # mission + constraints + acceptance
├── AGENTS.md                # ~100-line index to truth sources
├── harness.json             # commands + paths + acceptance summary
├── HARNESS_LINKS.md         # optional: repo ↔ external record-root mapping
├── features.json            # structured checklist with passes flag
├── CHANGELOG.md             # progress + failed attempts (include commit hashes)
├── init.sh                  # idempotent bootstrap (+ optional smoke/e2e)
├── harness/
│   ├── goal.md              # final goal / non-goals / approval boundaries
│   ├── contracts/           # sprint contracts / definitions of done
│   ├── assignments/         # standardized assignment briefs (optional)
│   ├── qa/                  # evaluator / verifier reports (optional)
│   └── handoff.md           # session / subagent handoff (optional)
├── docs/
│   ├── architecture.md      # dependency direction rules
│   └── quality.md           # tech-debt/quality notes
├── plans/                   # complex plan snapshots (optional)
├── artifacts/               # logs / screenshots / traces
├── scripts/
│   ├── run_drift_check.sh
│   └── run_change_guard.sh
└── tests/                   # at least one runnable oracle
```

## Key invariants

- `AGENTS.md` must point to the real sources of truth; it must not become a wiki.
- `harness/goal.md` should define the final goal, non-goals, constraints, and approval boundaries.
- `features.json` is a state machine: only flip `passes=true` after an oracle passes.
- `CHANGELOG.md` must include failed attempts, not just successes.
- `init.sh` must be safe to run repeatedly.
- `artifacts/` should absorb long logs so the main agent context stays clean.
