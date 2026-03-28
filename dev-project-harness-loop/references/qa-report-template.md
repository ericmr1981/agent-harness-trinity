# QA / Evaluator Report Template

Recommended path: `harness/qa/<sprint-id>.md`

---

## Sprint
- id:
- contract: `harness/contracts/<sprint-id>.md`

## Verdict
- PASS / FAIL
- If FAIL: list the minimum fixes required to pass.

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
