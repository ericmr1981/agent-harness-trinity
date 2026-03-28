# Agent contract (copy/paste)

Use this as the **header** when assigning development work to an agent against an external project record root.

## Core rule

- **Messages notify; files decide.**
- The agent may receive instructions in chat, but project truth must live in `Goal.md`, `Map.md`, `ProjectTasks.md`, and guard evidence.

## Assignment header

1) Read first:
- `Goal.md`
- `Map.md`
- `Harness_DoD.md`
- `ProjectTasks.md`

2) During work:
- Any change (code / doc / config / cron / deployment / ops behavior) must immediately update `ProjectTasks.md` change log with:
  - what changed
  - verification method
  - verification result
- Do not stop merely because one phase finished; continue until the goal is met or an approval boundary / blocker is hit.

3) Before claiming done:
- Run: `bash scripts/run_change_guard.sh "."` (from project record root)

4) Final response MUST include evidence:
- Current verdict: PASS / FAIL / PARTIAL
- Paste the full output of `run_change_guard.sh`
- Paste the new `ProjectTasks.md` change-log entry you added
- State any residual risk / next step

If evidence is missing or guard fails, the task is not accepted.

## Recommended final response format
- Change summary
- Verification
- DoD checklist (checked)
- Evidence: guard output
- Evidence: ProjectTasks change-log excerpt
- Residual risk / next step
