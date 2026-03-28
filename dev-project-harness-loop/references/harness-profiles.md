# Harness profiles (cost-aware)

Use the simplest profile that still meets acceptance.

## Profiles

### Solo
**Use when:** small, well-scoped changes with low ambiguity.
- Generator only (bounded bets) + guards
- Still requires L1/L2 acceptance where user-visible behavior changes

### PG (Planner + Generator)
**Use when:** the prompt is underspecified and the main failure mode is under-scoping or building the wrong thing.
- Planner expands a short prompt into `harness/spec.md`
- Generator implements against that spec

### PGE-final (Planner + Generator + Evaluator, evaluator at end)
**Use when:** medium risk; you want a skeptical review/QA pass without paying evaluator cost every sprint.
- Evaluator runs once at the end and files issues against the spec/contract

### PGE-sprint (Planner + Generator + Evaluator each sprint)
**Use when:** long-running / high risk / frequent stub-only failures / subjective quality matters.
- Every sprint is contract-first
- Evaluator enforces hard thresholds

## Rule of thumb
If the task sits beyond what the current model can do reliably solo, add an evaluator.

If the task is long-running and tends to drift, use sprint contracts.
