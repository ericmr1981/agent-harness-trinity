# QA / Evaluator Report Template

Recommended path: `harness/qa/<sprint-id>.md`

---

## Sprint
- id:
- contract: `harness/contracts/<sprint-id>.md`

## Verdict
- PASS / FAIL
- If FAIL: list the minimum fixes required to pass.

## Oracle Self-Check（必填 — 防止 self-attestation 幻觉）

> **Shadow Verifier 反做思维**：每个 acceptance criteria 必须通过以下测试。

对每条 criteria 填写：

| Criteria | Negative Test | 如果破坏会报错吗？ | Oracle 评级 |
|----------|--------------|-----------------|-------------|
| AC-1: ... | 尝试跳过/破坏它 | ✅ 会报错 / ❌ 不会 | STRONG / WEAK |
| AC-2: ... | ... | ... | ... |

**评级标准：**
- STRONG：negative test 存在且验证有效
- WEAK：只有 positive test，无反向验证 → **必须补充 negative test**

### 特别规则
如果某条 criteria 的 Oracle 评级为 **WEAK**，该 sprint **不得标记为 PASS**，除非：
1. 补充了有效的 negative test，且
2. negative test 也通过

## Rubric results
> Use hard thresholds. If any critical criterion fails → FAIL.

- Functionality / correctness:
- Product depth (no stub-only core interactions):
- UX / visual polish:
- Code quality / maintainability:
- Security basics (if applicable):

## Findings (actionable, reproducible)
For each finding:
- Title:
- Severity: blocker | major | minor
- Repro steps:
- Expected:
- Actual:
- Evidence: link to `artifacts/...`
- Suggested fix (ideally with file/line pointers):

## Coverage check
- Contract criteria coverage: (list which criteria were verified and how)

## Residual risk
-

## Regression Checklist（Bug Fix 必填）

> 如果本 sprint 包含 bug fix，此部分必须填写。

| Bet ID | Baseline 文件 | After 文件 | 新增失败项？ | Fix-Itself Test 存在？ |
|--------|--------------|-----------|------------|----------------------|
| bet-1  | artifacts/baseline-before-bet-1.txt | artifacts/baseline-after-bet-1.txt | 有/无 | 有/无 |
| ...    | ... | ... | ... | ... |

**逐条确认：**
- [ ] 所有 bet 开始前都有 baseline 测试记录
- [ ] 所有 bet 结束后都有 after 测试记录
- [ ] 没有新增失败项（diff baseline → after 为空或仅已知项）
- [ ] 每个 bug fix 都有 Fix-Itself Test

**如果任何一项未满足 → 不得标记本 sprint 为 PASS。**

## Evaluator attestation（签署）
- Verifier 不可以是 Builder本人
- 所有 evidence 必须可通过 `git clone` + 命令复现
- 签字: _________________ 日期: __________
