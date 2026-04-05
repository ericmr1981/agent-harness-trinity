---
name: harness
description: Alias command for /harness. Use when user types /harness to run the Trinity harness dispatch workflow (generate sprint contracts + spawn configs). Internally delegates to skills/harness-dispatch.
---

# /harness (native-skill alias)

This is a thin alias so `/harness` works as a **native skill command**.

## Delegation
This command delegates to:
- `skills/harness-dispatch` (see `skills/harness-dispatch/SKILL.md`)

## Notes
- Prefer using `/harness <task>` in chat.
- The dispatch implementation lives in `skills/harness-dispatch`.
