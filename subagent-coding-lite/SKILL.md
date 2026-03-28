---
name: subagent-coding-lite
description: Lightweight subagent dispatch for coding tasks that complements the Agent Harness Trinity without changing its core design. Standardizes task briefs, acceptance oracles, and handoff packets so subagent work is bounded, verifiable, and easy to merge back into the main harness loop. Uses only OpenClaw subagents.
---

# Subagent Coding Lite

A minimal extension skill for **agent-harness-trinity**.

Goal: use OpenClaw subagents to accelerate coding work **without weakening** Trinity guarantees (bounded bets, verifiable oracles, durable records).

## Design constraints (defaults)

- **Subagent does NOT commit.**
  - It may edit working tree files, but must not run `git commit`, `git push`, create PRs, or change remote state.
- **Main agent owns the merge step:** final verification, guard runs, commit message discipline, and logging.
- **Default acceptance (P0):** lint + typecheck + unit tests (if present) + minimal manual check.
- **Escalate to P1 (add one critical e2e) when risk is high** (auth, permissions, payments, data writes, routing/state core).
- **Context protection:** subagent absorbs high-volume tool output; main agent keeps the primary context clean.
- **Log hygiene:** if command output is long, write it to `artifacts/` and return only a short excerpt + file path.

## Where this fits (after harness upgrades)

This skill is the execution-layer companion to `dev-project-harness-loop`.

- `dev-project-harness-loop` defines: profile selection, contract-first discipline, evaluator thresholds, guard gates.
- `subagent-coding-lite` defines: how to dispatch bounded subagent work so it stays verifiable and easy to merge.

It is compatible with the Planner/Generator/Evaluator split:
- subagent can be assigned role=`planner`, `generator`, or `evaluator`
- role is enforced by **artifact contracts + gate checks**, not by tool-permission isolation

## When to use

Use this skill when you have a **bounded, code-focused** task that can be delegated:
- implement a small feature or UI tweak
- refactor a module with clear safety net
- fix a reproducible bug
- add/update a test
- run high-output build/test/e2e loops and capture artifacts

Do NOT use when:
- scope is ambiguous (needs product decisions)
- destructive deploy/migrations are involved
- credentials/billing are required

## Subagent dispatch checklist

Before spawning a subagent, prepare:
1) Goal (1 sentence)
2) Scope boundaries (Do / Don’t)
3) Context pointers (paths, relevant files, errors)
4) Acceptance oracle (P0 or P1)
5) Output contract (Handoff Packet)
6) (If sprinted harness work) contract/spec pointers under `harness/`:
   - `harness/spec.md`
   - `harness/contracts/<sprint-id>.md`
   - `harness/qa/<sprint-id>.md`

## Templates

- Assignment brief: `TEMPLATE_ASSIGNMENT.md`
- Handoff packet: `TEMPLATE_HANDOFF.md`

## Recommended workflow (fits Trinity)

1) Main agent chooses a bounded bet (per `dev-project-harness-loop`).
2) If the bet is code-heavy or high-output, spawn a subagent and paste the assignment brief.
3) Subagent returns:
   - what changed (files + intent)
   - verification evidence
   - artifacts paths (`artifacts/...`)
   - handoff packet
4) Main agent:
   - re-runs the oracle (do not trust unverified claims)
   - runs harness guards (if applicable)
   - commits + logs progress

## Suggested OpenClaw subagent prompt wrapper

Paste this (fill the placeholders) when spawning a subagent:

```
You are a subagent. You may edit files, but you MUST NOT commit, push, open PRs, or change any remote state.

Follow this structure:
1) Restate goal + non-goals
2) Plan (3-7 steps)
3) Make bounded changes
4) Run/describe verification evidence (commands + results)
5) Return a Handoff Packet in the requested format

ASSIGNMENT
<PASTE TEMPLATE_ASSIGNMENT FILLED>
```
