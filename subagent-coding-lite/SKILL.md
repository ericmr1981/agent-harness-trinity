---
name: subagent-coding-lite
description: Lightweight subagent dispatch for coding tasks that complements the Agent Harness Trinity without changing its core design. Standardizes role-based assignment briefs, acceptance oracles, artifact-driven handoffs, and verification packets so subagent work is bounded, verifiable, and easy to merge back into the main harness loop. Uses only OpenClaw subagents.
---

# Subagent Coding Lite

A minimal extension skill for **agent-harness-trinity**.

Goal: use OpenClaw subagents to accelerate coding work **without weakening** Trinity guarantees (goal-closed progress, bounded bets, verifiable oracles, durable records).

## Design constraints (defaults)

- **Subagent does NOT commit.**
  - It may edit working tree files, but must not run `git commit`, `git push`, create PRs, or change remote state.
- **Main agent owns the merge step.**
  - Final verification, guard runs, commit message discipline, and durable logging remain with the main agent.
- **Artifact-first coordination.**
  - Use messages to launch / summarize; use repo files for truth.
- **Default acceptance (P0).**
  - lint + typecheck/build + unit tests (if present) + minimal manual check.
- **Escalate to P1** when risk is high.
  - Add one critical e2e/spec for auth, permissions, payments, data writes, or routing/state core.
- **Context protection.**
  - Subagent absorbs high-volume tool output; main agent keeps the primary context clean.
- **Human interruption policy.**
  - Subagent should not ask for confirmation after every phase; escalate only on blocker, approval boundary, or contract ambiguity.

## Where this fits

This skill is the execution-layer companion to `dev-project-harness-loop`.

- `dev-project-harness-loop` defines: goal contract, profile selection, contract-first discipline, evaluator thresholds, guard gates.
- `subagent-coding-lite` defines: how to dispatch bounded subagent work so it stays role-correct, verifiable, and easy to merge.

It is compatible with the Planner / Builder / Verifier split:
- subagent can be assigned role=`planner`, `builder`, `verifier`, or `researcher`
- role is enforced by **artifact contracts + gate checks**, not by wishful prompting

## When to use

Use this skill when you have a **bounded, code-focused** task that can be delegated:
- implement a small feature or UI tweak
- refactor a module with clear safety net
- fix a reproducible bug
- add/update a test
- run high-output build/test/e2e loops and capture artifacts
- perform independent verification on a bounded change

Do NOT use when:
- scope is ambiguous and needs product decisions
- destructive deploy/migrations are involved
- credentials/billing are required

## Default dispatch triggers

Prefer a subagent when any of the following is true:
- task likely takes more than ~5 minutes
- task will produce lots of logs / browser output
- independent verification is valuable
- task can run in parallel with another bounded task

Stay in the main agent when the task is:
- a tiny edit
- a short answer / check
- mostly orchestration rather than implementation

## Required assignment fields

Every subagent brief should specify:
1) role
2) mission
3) scope boundaries
4) contract / goal pointers
5) allowed capabilities
6) acceptance oracle
7) output contract
8) escalation rule

Templates:
- Assignment brief: `TEMPLATE_ASSIGNMENT.md`
- Handoff packet: `TEMPLATE_HANDOFF.md`
- Role charters: `references/role-charters.md`

## Information exchange protocol

Use this flow:
1) Main agent writes / points to artifact truth (`harness/goal.md`, contracts, prior QA, relevant code paths).
2) Main agent spawns subagent with a short assignment message that points to those artifacts.
3) Subagent works within scope and stores long output under `artifacts/`.
4) Subagent returns a **Handoff Packet** with facts, evidence, risks, and next steps.
5) Main agent re-verifies, runs guards, commits, and updates durable records.

Rules:
- separate **facts** from **assessment** from **recommendation**
- prefer file paths over pasted log walls
- use a single writer per artifact type

## Suggested OpenClaw subagent prompt wrapper

Paste this (fill the placeholders) when spawning a subagent:

```
You are a subagent. You may edit files, but you MUST NOT commit, push, open PRs, or change any remote state.

Follow this structure:
1) Restate role + goal + non-goals
2) Plan (3-7 steps)
3) Make bounded changes
4) Run/describe verification evidence (commands + results)
5) Return a Handoff Packet in the requested format

ASSIGNMENT
<PASTE TEMPLATE_ASSIGNMENT FILLED>
```
