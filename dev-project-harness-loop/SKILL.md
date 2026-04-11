---
name: dev-project-harness-loop
description: Dev project harness loop: contracts, role separation, verifiable oracles, change-guards, durable records. Use when the agent owns a repo end-to-end with auditability.
---

# Dev Project Harness Loop — Core SOP

> Full reference: `references/SKILL-reference.md`（含 Step 0-10 完整说明、profiles、examples）

---

## Non-negotiable Rules

**No harness evidence → no acceptance claim.**

Progress requires ALL of:
1. implementation change
2. verification evidence (external oracle)
3. durable record updated
4. guard passes (or explicit risk acceptance logged)

**Final goal is the default stop point.** Do not stop merely because one subtask finished.
**Messages are for orchestration; artifacts are for truth.**
**Builder does not self-accept.**

---

## Bounded Loop

```
1. Resume from repo truth (git log / CHANGELOG.md / features.json)
2. Pick highest-priority unfinished task
3. Define done → sprint contract (harness/contracts/<id>.md)
4. Bounded bet: implement → oracle verify → evidence → commit
5. Planner reconcile: continue / pivot / stop
6. Guard before milestone claims
```

---

## Stop Conditions（只在这时停）

- final oracle passed ✅
- approval boundary reached（部署/凭证/方向模糊）
- blocked external / blocked approval

**Otherwise → continue or pivot.**

---

## Oracle Rules（每 sprint 必填）

L1 必须：**外部可执行 + 有 negative test**，禁止 self-attestation。
Regression：改 bug 时 baseline diff 必须 clean。

详见：`references/sprint-contract-template.md` Oracle Rules 章节

---

## Failure → Retry ≤ 2 → Escalate

详见：`references/failure-recovery-protocol.md`

---

## Minimal File Requirements（repo 内）

`AGENTS.md` · `features.json` · `CHANGELOG.md` · `init.sh` · `harness.json` · `harness/goal.md` · `tests/`

缺失时：`bash project-harness-guards/scripts/scaffold_harness.sh`

---

## ContextAssembler（subagent 注入前自动跑）

```
node scripts/context-assembler/context-assembler.js <repoPath> <task> \
  [--max-files 12] [--max-file-size-kb 8] [--max-chars 20000]
```

`--mode minimal` 时跳过。

---

## Guard

```bash
bash scripts/run_change_guard.sh
bash scripts/run_drift_check.sh
```

---

## Full Reference
`references/SKILL-reference.md`
