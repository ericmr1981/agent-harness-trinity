---
name: subagent-coding-lite
description: Lightweight subagent dispatch for coding tasks that complements the Agent Harness Trinity without changing its core design. Standardizes task briefs, acceptance oracles, and handoff packets so subagent work is bounded, verifiable, and easy to merge back into the main harness loop. Uses only OpenClaw subagents.
---

# Subagent Coding Lite

A minimal extension skill for **agent-harness-trinity**.

Goal: use OpenClaw subagents to accelerate coding work **without weakening** the Trinity guarantees (bounded bets, verifiable oracles, durable records).

## Design constraints (defaults)

- **Subagent does NOT commit.**
  - It may edit working tree files, but must not run `git commit`, `git push`, create PRs, or change remote state.
- **Main agent owns the merge step:** final verification, guard runs, commit message discipline, and logging.
- **Default acceptance (P0):** lint + typecheck + unit tests (if present) + minimal manual check.
- **Escalate to P1 (add one critical e2e) when risk is high** (auth, permissions, payments, data writes, routing/state core).

## When to use

Use this skill when you have a **bounded, code-focused** task that can be delegated:
- implement a small feature or UI tweak
- refactor a module with clear safety net
- fix a reproducible bug
- add/update a test

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

## Templates

- Assignment brief: `TEMPLATE_ASSIGNMENT.md`
- Handoff packet: `TEMPLATE_HANDOFF.md`

## Recommended workflow (fits Trinity)

1) Main agent chooses a bounded bet (per `dev-project-harness-loop`).
2) If the bet is code-heavy, spawn a subagent and paste the assignment brief.
3) Subagent returns:
   - what changed (files + intent)
   - verification evidence
   - handoff packet
4) Main agent:
   - re-runs the oracle (do not trust unverified claims)
   - runs harness guards (if applicable)
   - commits + logs progress

## Suggested OpenClaw subagent prompt wrapper

Paste this (fill the placeholders) when spawning a subagent:

```
You are a coding subagent. You may edit files, but you MUST NOT commit, push, open PRs, or change any remote state.

Follow this structure:
1) Restate goal + non-goals
2) Plan (3-7 steps)
3) Make bounded changes
4) Run/describe verification evidence (commands + results)
5) Return a Handoff Packet in the requested format

ASSIGNMENT
<PASTE TEMPLATE_ASSIGNMENT FILLED>
```
