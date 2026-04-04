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

## Regression Prevention（强制 — Bug Fix 必须遵守）

> 目的：改 bug 时不引入新 bug。

### Bug Fix 专项约束
如果本 sprint 包含 bug fix，必须遵守：

**1. Bet 开始前：记录 baseline**
```bash
# 每个 bet 开始前，跑测试并保存结果
npm test > artifacts/baseline-before-<bet-id>.txt 2>&1
echo "BASELINE_EXIT_CODE=$?" >> artifacts/baseline-before-<bet-id>.txt
```
baseline 文件必须 commit（不然后面无法对比）。

**2. Bet 结束后：确认无新增失败**
```bash
npm test > artifacts/baseline-after-<bet-id>.txt 2>&1
diff artifacts/baseline-before-<bet-id>.txt artifacts/baseline-after-<bet-id>.txt
# 如果有新增失败项 → 新 bug 引入，必须先修再继续
```

**3. Bug fix 必须同时写 Fix-Itself Test**
- 在 `tests/` 或 `spec/` 下新增一个 test
- 这个 test 在 bug 存在时 FAIL，修复后 PASS
- 如果是纯 UI/手动流程 bug，写在 `features.json` 对应条目下作为验证条件

**4. Atomic 约束**
- 一个 bet / commit 只改一个功能点或一个 bug
- 如果发现自己在修 bug 时顺手改了无关代码 → 必须拆开
- Review 时问："这个 commit 改了什么？" 答不上来 → 拆

### Regression Oracle 示例
```bash
# Baseline diff（最简回归验证）
npm test 2>&1 | tee artifacts/test-after-<bet-id>.log
# 必须：after 的失败数 ≤ before 的失败数
# 禁止：after 出现 before 没有的失败项
```

## Risks / assumptions
-

## Negotiation notes (Generator ↔ Evaluator)
-
