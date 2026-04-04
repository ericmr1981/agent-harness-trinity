# Sprint Contract Template

> Contract-first: define "done" before writing code.

Recommended path: `harness/contracts/<sprint-id>.md`

---

## Sprint
- id:
- date:
- owner:
- harness profile: Solo | PG | PGE-final | PGE-sprint

## Sprint goal (1 sentence)

## Scope
- In scope:
- Out of scope:
- Non-goals:

## Acceptance criteria (numbered, testable)
1.
2.
3.

## Verification plan
### L1 (engineering)
- commands:

### L2 (user acceptance)
Minimum: happy path + edge/permission/error path.
- Scenario A (happy path)
  - Steps:
  - Expected:
- Scenario B (edge/permission/error)
  - Steps:
  - Expected:

## Oracle Rules（强制 — 不可绕过）

> 目的：防止 Builder 自我认可幻觉。所有验收命令必须满足以下条件。

### L1 Oracle 必须满足
- ✅ **外部可执行**：任何人在 repo 干净 clone 后可跑相同命令得到相同结论
- ✅ **外部裁判**：结果由外部系统判定（API 真实返回、DB 真实状态、文件系统真实 diff），不是 agent 自己 `echo "PASS"`
- ✅ **Negative test**：每条 acceptance criteria 至少一条反向测试（故意破坏后系统应正确报错）
- ❌ **禁止 self-attestation**：`curl ... | grep "ok" && echo "PASS"` 这类命令不算有效 oracle
- ❌ **禁止纯字符串匹配**：`grep "success" output.txt` 作为唯一 oracle 无外部裁判

### L2 Oracle（用户场景）必须满足
- ✅ **真实操作序列**：可交给一个不懂代码的人按步骤执行
- ✅ **可观察的结果**：截图 / API 返回 / DB 查询等可见证据
- ❌ **禁止"我认为"**：主观判断不是 oracle

### 自动检查清单（跑完 L1 后必填）
在 `harness/qa/<sprint-id>.md` 中必须回答：
```
对于每条 acceptance criteria：
  Q: "如果我故意让这个功能坏掉，我的 L1 oracle 会报错吗？"
  如果答案是"不会" → 该 oracle 不够硬，标记为 WEAK，补充 negative test
```

## Evidence locations
- long logs: `artifacts/`
- screenshots: `artifacts/screenshots/`
- traces/videos (if any): `artifacts/traces/`

## Pass/fail thresholds (rubric)
- rubric used: `references/rubrics/<...>.md`
- thresholds:
  - Functionality: PASS/FAIL (must pass)
  - UX/Visual polish: >= <threshold> (if applicable)
  - Code quality: >= <threshold>
  - Security basics: PASS/FAIL (if applicable)

## Risks / assumptions
-

## Negotiation notes (Generator ↔ Evaluator)
-
