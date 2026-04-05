---
name: kickoff
description: Alias command for Project Kickoff. Use when user types /Kickoff to generate early-stage docs (PRD + architecture draft + ADR) and bootstrap goal/features. Internally delegates to the project-kickoff module.
---

# /Kickoff (alias)

This is a thin alias skill so users can invoke **`/Kickoff`** as a native skill command.

## What it does
Delegates to the Trinity module:
- `project-kickoff` (see `project-kickoff/SKILL.md`)

## Deterministic execution
Run the scaffolder script:

```bash
node project-kickoff/scripts/kickoff.js --repo "/abs/path/to/repo" --name "<project-name>" --desc "<1-2 line description>"
```

## Notes
- Token-safety: do not attach whole docs to subagents.
- If more context is needed, request file + section/lines + why (max 3 items).
