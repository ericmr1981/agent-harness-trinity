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

## Evaluator attestation（签署）
- Verifier 不可以是 Builder本人
- 所有 evidence 必须可通过 `git clone` + 命令复现
- 签字: _________________ 日期: __________
