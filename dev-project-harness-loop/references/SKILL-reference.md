# Dev Project Harness Loop — Complete Reference

> Core SOP: `SKILL.md`（~2KB，必读）
> 本文件：完整 Step-by-step 文档（~11KB，按需查阅）

---

## Non-negotiable Rules

**No harness evidence → no acceptance claim.**

Accepted progress requires:
1. implementation change
2. verification evidence (oracle)
3. durable record updated
4. guard passes (or explicit risk acceptance recorded)

Also:
- **Final goal is the default stop point.** Do not stop merely because one stage or subtask finished.
- **Messages are for orchestration; artifacts are for truth.**
- **Builder does not self-accept.** Use a verifier/evaluator whenever risk or ambiguity justifies it.

## Step 0) Ensure the harness exists (initializer phase)

Minimum harness files (repo-local):
- `AGENTS.md`, `features.json`, `CHANGELOG.md` (or `claude-progress.txt`), `init.sh`, `harness.json`, `harness/goal.md`, `tests/`

If missing:
- use `project-harness-guards` to scaffold
- copy guard scripts into the repo at `scripts/`:
  - `run_drift_check.sh`
  - `run_change_guard.sh`

If governance lives outside the repo (e.g., Obsidian), add `HARNESS_LINKS.md` that maps repo ↔ record-root.

## Step 1) Resume from repo truth

At session start, always:
- `git log` (recent commits)
- read `CHANGELOG.md` (last iteration + failures)
- inspect `features.json` for remaining `passes=false`
- run `bash init.sh` if environment may have drifted

**Per-project ACTIVE.md:**
- Project state lives **inside each project repo** as `ACTIVE.md`
- TASKS.md is the single project registry index (replaces old WORKSPACE.md)
- When resuming a project: read `ACTIVE.md` from that project's repo, not workspace root
- On new dispatch: `updateActive()` writes to `<project-repo>/ACTIVE.md` and updates `TASKS.md` index

## Step 1.5) ContextAssembler

**Before every `/harness` dispatch**, ContextAssembler runs automatically (except in `--mode minimal`):

```
ContextAssembler(repoPath, taskDescription)
    ├── git state        → branch / status / recent commits / uncommitted diff
    ├── features.json    → unfinished features (passes=false)
    ├── harness/contracts → latest sprint contract
    ├── harness/handoffs → latest handoff packet
    ├── ACTIVE.md        → current WIP state
    └── relevant sources → task-keyword-matched source files (top 12, ≤8KB each)
         ↓
harness/context/context-package-<timestamp>.md
         ↓
Injected as FIRST attachment in subagent context
```

CLI limits (override defaults):
```
--max-files 12 --max-file-size-kb 8 --max-chars 20000
```

When skipped: `--mode minimal`

## Step 2) Establish the Goal Contract

Recommended path: `harness/goal.md`
Template: `references/goal-contract-template.md`

Minimum fields: final goal, non-goals, constraints, approval boundaries, stop conditions, reporting mode.

## Step 2.5) Choose a harness profile

- **Solo**: generator only + guards
- **PG**: planner + generator
- **PGE-final**: planner + generator + evaluator (once at end)
- **PGE-sprint**: planner + generator + evaluator per sprint (highest cost, highest reliability)

See: `references/harness-profiles.md`

## Step 3) Contract-first execution

Define "done" before implementing. Sprint contract: `harness/contracts/<sprint-id>.md`
Template: `references/sprint-contract-template.md`

## Step 3.5) Role discipline

Default roles:
- **Planner / Orchestrator** — picks next bounded task, maintains goal state
- **Builder / Generator** — implements the current bounded task
- **Verifier / Evaluator** — independently tests and judges against the contract
- **Researcher** — gathers external knowledge without changing product code

Single-writer rule: planner owns goal/task artifacts; builder owns implementation; verifier owns QA artifacts.

## Step 4) Run bounded iterations

```
1. baseline (current failure / oracle signal)
2. pick one bounded bet
3. implement
4. verify (L0 → L1 → L2 oracle ladder)
5. decide keep / rework / revert
6. update durable artifacts
7. commit + log (include commit hash)
8. flip features.json only after oracle passes
```

## Step 5) Planner reconcile loop

After each round:
1. re-read goal contract + current truth
2. mark completed work done
3. record failed/partial with evidence
4. pick highest-priority unfinished task
5. decide whether to continue
6. explicitly check: if I stop now, can the human accept?

**Continue Gate (v5):**
- `goal_closed` / `retry_with_new_bet` / `pivot_required` / `blocked_external` / `blocked_approval`
- Same branch + 2 no-evidence rounds → pivot automatically + notify Boss
- local oracle success does not override final oracle

## Step 6) Noise isolation

- Use subagent for high-output rounds (see `subagent-coding-lite`)
- Main agent: orchestrator only
- Long output → `artifacts/` + link from CHANGELOG.md

## Step 7) Guard before milestone claims

```bash
bash scripts/run_change_guard.sh
```

## Step 8) Failure Recovery

Classify: L0 (build) / L1 (test) / L2 (UX)
Auto-retry: up to 2 attempts with different fixes
Then: escalate or backlog

See: `references/failure-recovery-protocol.md`

## Step 9) Auto-Resume

At session start:
1. Read TASKS.md → find active project index
2. Read per-project ACTIVE.md → check for running session
3. If running: fetch session history, extract handoff, resume
4. If not running: read harness truth
5. Reconcile: continue or start from harness

See: `references/auto-resume-protocol.md`

## Step 10) CLI Integration

When using `/harness <task>`:
1. Auto-inject: `dev-project-harness-loop/SKILL.md` + `subagent-coding-lite/SKILL.md` + agency role
2. Auto-score task → decide if subagent needed
3. Auto-create artifacts: goal.md, contracts, assignments

## Oracle Rules（强制）

### L1 Oracle
- ✅ 外部可执行
- ✅ 外部裁判
- ✅ Negative test
- ❌ Self-attestation: `curl ... && echo "PASS"`
- ❌ 纯字符串匹配无外部裁判

### Regression Prevention（Bug Fix 必填）
- Bet 开始前：保存 baseline 测试
- Bet 结束后：diff baseline vs after
- Bug fix 必须同时写 Fix-Itself Test

详见：`references/sprint-contract-template.md` Oracle Rules + Regression Prevention 章节

## References

- `references/goal-contract-template.md`
- `references/assignment-header.md`
- `references/harness-profiles.md`
- `references/sprint-contract-template.md`
- `references/qa-report-template.md`
- `references/failure-recovery-protocol.md`
- `references/auto-resume-protocol.md`
- `references/minimal-flow-example.md`
- `references/rubrics/frontend.md`
- `references/rubrics/fullstack.md`
- `references/anthropic-effective-harnesses-mapping.md`
- `references/v5-continue-gate.md`
