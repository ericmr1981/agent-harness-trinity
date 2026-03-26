# Agent contract (copy/paste)

Use this as the **header** when assigning development work to an agent.

## Assignment header

1) Read first:
- `Map.md`
- `Harness_DoD.md`

2) During work:
- Any change (code/doc/config/cron/deployment/ops behavior) must immediately update `ProjectTasks.md` change log with: **what changed + verification method + verification result**.

3) Before claiming done:
- Run: `bash scripts/run_change_guard.sh "."` (from project record root)

4) Final response MUST include evidence:
- Paste the full output of `run_change_guard.sh`
- Paste the new `ProjectTasks.md` change-log entry you added

If evidence is missing or guard fails, the task is not accepted.

## Recommended final response format
- Change summary
- Verification
- DoD checklist (checked)
- Evidence: guard output
- Evidence: ProjectTasks change-log excerpt
