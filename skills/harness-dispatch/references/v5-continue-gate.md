# harness-dispatch v5 — Continue Gate + Pivot Design

Status: design draft (not implemented yet)

## Goal
Prevent the harness from exiting into progress-report mode when the final acceptance oracle still fails and no true blocker exists.

## New round outcomes
Replace loose "phase complete / report" behavior with explicit outcomes:
- `goal_closed`
- `retry_with_new_bet`
- `pivot_required`
- `blocked_external`
- `blocked_approval`

## Continue Gate Rules
Default rule after each verification step:
1. If final oracle passed → `goal_closed`
2. If approval boundary hit → `blocked_approval`
3. If external/platform/tooling boundary hit → `blocked_external`
4. If final oracle failed but a next bounded repair step is clear → `retry_with_new_bet`
5. If the same branch produced no meaningful new evidence for 2 consecutive rounds → `pivot_required`

## Non-completion conditions
The following do **not** justify stopping a round:
- local build/tests passed
- issue scope was narrowed
- a blocker was identified but is still actionable
- partial deployment or partial live verification succeeded

## Pivot Rule
If two consecutive rounds on the same branch produce no meaningful new evidence:
- change branch/approach automatically
- inform Boss of the strategy change
- do not ask for confirmation unless a new approval boundary appears

## Evidence Delta
The planner should compare each round against the previous round and ask:
- Did we get a new failing log, stack trace, or query result?
- Did we observe a new runtime behavior difference?
- Did a different oracle level change state?
- Did we eliminate a hypothesis with evidence?

If the answer is no for two rounds in a row on the same branch, pivot.

## Required output fields
Future harness outputs should include:
- `finalOracle`
- `currentBlocker`
- `roundOutcome`
- `stopAllowed`
- `nextForcedBet`
- `evidenceDelta`
- `pivotAfterNoEvidenceRounds`

## Expected effect
The dispatch layer stops treating “the problem is now well understood” as a valid stopping point. Instead, narrowed scope becomes input to the next bounded repair step.
