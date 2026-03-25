# Progress log format (CHANGELOG.md / claude-progress.txt)

## Purpose

Preserve continuity across context windows and days.

## Minimal entry template

```
## YYYY-MM-DD HH:MM
- goal: <one sentence>
- bet: <what you tried>
- commit: <git short sha or 'n/a'>
- verification:
  - command: <what you ran>
  - result: <pass/fail + key output>
- decision: keep | rework | revert | blocked
- next: <next bet or blocker>
```

## Rules

- Always include `commit:` when running inside a git repo.
- If you revert, log *why* (root cause) so future sessions don’t repeat it.
