---
name: project-kickoff
description: Standardize new project kickoff: capture requirements, align architecture/tech choices, and generate developer-ready docs (PRD/spec, ADRs, goal contract, feature checklist). Use when user says “kickoff 新项目/启动新项目/项目立项/需求澄清/架构对齐/技术选型”, or asks for an independent kickoff command (e.g. /Kickoff).
---

# Project Kickoff (Trinity module)

## What this module is
A lightweight, **independent kickoff command** that scaffolds a new project's early-phase docs and alignment artifacts, without invoking the full sprint dispatch.

Primary goal: **standardize early-stage development flow** so that requirements + architecture/tech choices become explicit, reviewable, and usable by engineers.

## Command (manual)
### Short command (chat intent)
Use: **`/Kickoff <project>`**

### Deterministic CLI (preferred)
```bash
# Recommended (Way #1): only provide --name; repo defaults to "$GITHUB_ROOT/<project-name>"
node project-kickoff/scripts/kickoff.js --name "<project-name>" --desc "<1-2 line description>"

# Optional: override repo location
node project-kickoff/scripts/kickoff.js --repo "/abs/path/to/repo" --name "<project-name>" --desc "<1-2 line description>"
```

Optional flags:
- `--stack "node"|"python"|"go"|"mixed"` (default: mixed)
- `--mode "lean"|"full"` (default: lean)

## Outputs (written into the target repo)
- `docs/kickoff/PRD.md` (requirements + acceptance)
- `docs/kickoff/ARCHITECTURE_DRAFT.md` (architecture sketch + boundaries)
- `docs/decisions/ADR-0001-tech-stack.md` (tech options + decision template)
- `harness/goal.md` (goal contract skeleton, if missing)
- `features.json` (minimal skeleton, if missing)

## Operating rules (token safety)
- Do **not** paste huge docs into subagents.
- If additional context is needed, request **file + section/lines + why** (max 3 items).

## When to run kickoff vs /harness
Run **kickoff** when:
- project is new, requirements are still unclear
- architecture/tech choices need alignment
- you want docs that engineers can implement from

Run **/harness** when:
- you already have a clear task and want sprint contracts + dispatch

## Next step after kickoff
After kickoff docs are confirmed, proceed with:
- `/harness "<build task>"` to generate sprint contracts

