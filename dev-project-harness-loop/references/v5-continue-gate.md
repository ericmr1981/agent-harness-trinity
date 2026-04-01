# dev-project-harness-loop v5 — Goal-Closed Continue Gate

Status: v5-preview implemented in runtime (goal_closed input/backfill, report result consumption, continue-gate state artifacts)

## Problem
A long-running project can still fail if the loop switches from execution mode to report mode after only narrowing the blocker.

## v5 design intent
Make the default post-failure action:
- continue with the next bounded repair step, or
- pivot strategy after two no-evidence rounds,
not “pause and summarize”.

## Final-oracle rule
Before ending a round, force the planner to ask:
> If I stop now, can the human accept the final goal?

If the answer is no, and there is no approval boundary or external blocker, the planner must continue automatically.

## Local oracle vs Final oracle
Local oracle examples:
- build passes
- tests pass
- migration applied
- deploy completed
- page/API reachable

Final oracle examples:
- the real end-to-end workflow the human requested
- the live production behavior is correct
- the user-visible acceptance path is verified

Rule:
- local oracle success is not enough to stop
- final oracle controls completion

## New round outcomes
- `goal_closed`
- `retry_with_new_bet`
- `pivot_required`
- `blocked_external`
- `blocked_approval`

## Pivot rule
If the same branch produces no meaningful evidence delta for two consecutive rounds:
- pivot strategy automatically
- inform Boss
- do not ask for confirmation unless the pivot crosses an approval boundary

## Template impact
ACTIVE/report/handoff templates should gain:
- `Final Oracle`
- `Current Blocker`
- `Stop Allowed`
- `Next Forced Bet`
- `Pivot Trigger`
- `Last Evidence`
- `Local Oracle`
- `Result Consumed At`
- `harness/artifacts/continue-gate/<sprint>.json` state snapshot

## Expected effect
The loop becomes goal-closed in practice, not just in rhetoric. “Problem narrowed” no longer behaves like a hidden stop condition.
