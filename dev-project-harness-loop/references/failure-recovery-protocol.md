# Failure Recovery Protocol

## Purpose

Enable autonomous recovery from common failures without human intervention.

---

## Failure Classification

### L0 Failures (Build/Environment)

**Symptoms**:
- `npm run build` fails
- TypeScript errors
- Missing dependencies
- Environment drift

**Auto-Recovery**:
```
Attempt 1: 
  - Read error message
  - Identify fix (install package, fix syntax, update import)
  - Apply fix
  - Retry

Attempt 2:
  - If same error persists
  - Try alternative approach (different package, different pattern)
  - Retry

Attempt 3:
  - If still failing
  - ESCALATE to human
  - Provide: error log, attempted fixes, recommendation
```

**Evidence Required**:
- Error log: `artifacts/build-error-<timestamp>.log`
- Fix attempts: `artifacts/build-fix-attempts.md`

---

### L1 Failures (Test Failures)

**Symptoms**:
- `npm test` fails
- Unit test failures
- Integration test failures

**Auto-Recovery**:
```
Step 1: Classify failure
  - Flaky test? (random, timing-dependent)
  - Real bug? (deterministic, logic error)
  - Test bug? (wrong assertion, outdated test)

Step 2: Action
  - Flaky test → Mark in `artifacts/flaky-tests.md`, continue
  - Real bug → Create bug ticket, fix if <30min, else continue other tasks
  - Test bug → Fix test, rerun

Step 3: Decision
  - If fix successful → Continue
  - If fix fails after 2 attempts → Create follow-up task, continue other work
```

**Evidence Required**:
- Test output: `artifacts/test-failure-<timestamp>.log`
- Classification: `artifacts/test-failure-analysis.md`

---

### L2 Failures (Manual Check / UX Issues)

**Symptoms**:
- Visual regression
- UX doesn't match expectation
- Performance below threshold

**Auto-Recovery**:
```
Step 1: Document discrepancy
  - Screenshot: `artifacts/ux-issue-<timestamp>.png`
  - Description: what vs expected

Step 2: Assess severity
  - Critical (blocking) → Fix immediately
  - Major (significant) → Create task, fix in next iteration
  - Minor (cosmetic) → Create backlog task

Step 3: Decision
  - If critical + fixable in <1h → Fix now
  - Else → Create task, continue other work
```

**Evidence Required**:
- Screenshot: `artifacts/ux-issue-*.png`
- Analysis: `artifacts/ux-issue-analysis.md`

---

## Retry Limits

| Failure Type | Max Retries | Then |
|-------------|-------------|------|
| L0 (Build) | 2 | Escalate to human |
| L1 (Test) | 2 | Create follow-up task |
| L2 (UX) | 1 | Create backlog task |
| Subagent crash | 1 | Restart with clearer instructions |

---

## Escalation Protocol

**When to escalate**:
1. Max retries exceeded
2. Unknown error (can't classify)
3. Requires human decision (API key, design choice)
4. Risk of breaking production

**Escalation format**:
```markdown
## 🚨 Escalation Required

**Task**: <current task>
**Failure**: <error summary>
**Attempts**: <what was tried>
**Evidence**: <links to artifacts>
**Recommendation**: <what you suggest>
**Blocking**: <yes/no, if yes what>
```

---

## Recovery State Machine

```
┌─────────────┐
│  Task Start │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Execute    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Verify     │
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
  Pass    Fail
   │       │
   │       ▼
   │  ┌─────────────┐
   │  │  Classify   │
   │  └──────┬──────┘
   │         │
   │    ┌────┴────┐
   │    │         │
   │  L0/L1     L2
   │    │         │
   │    ▼         ▼
   │  ┌─────────────┐
   │  │  Retry ≤2?  │
   │  └──────┬──────┘
   │         │
   │    ┌────┴────┐
   │    │         │
   │   Yes       No
   │    │         │
   │    │         ▼
   │    │    ┌─────────────┐
   │    │    │  Escalate   │
   │    │    │  or Backlog │
   │    │    └─────────────┘
   │    │
   │    │ (retry)
   └────┘
```

---

## Integration with Harness Loop

After each bounded bet:

1. Run oracle (L0 → L1 → L2)
2. Compare evidence delta versus the previous round on the same branch
3. If fail but a next bounded repair step is clear → continue (`retry_with_new_bet`)
4. If two consecutive rounds on the same branch produce no meaningful new evidence → pivot strategy automatically (`pivot_required`) and notify Boss
5. If recover → Update `features.json`, continue
6. If escalate → Update `harness/escalations/<id>.md`, pause this task, work on other tasks

### Continue Gate Rule (v5 preview)
A narrowed blocker is not a valid stopping condition by itself.
Only stop when one of the following is true:
- final oracle passed
- approval boundary reached
- external blocker reached

Otherwise, continue or pivot.

---

## Examples

### Example 1: Build Error Recovery

```
Task: Add React virtualization

L0 Check: npm run build
❌ Error: Cannot find module '@tanstack/react-virtual'

Recovery Attempt 1:
- Diagnosis: Missing dependency
- Fix: npm install @tanstack/react-virtual
- Retry: npm run build
✅ Pass → Continue

---

### Example 2: Test Failure Recovery

```
Task: Implement user authentication

L1 Check: npm test
❌ Error: expect(received).toBe(expected) // expected: 200, received: 401

Recovery Attempt 1:
- Classification: Real bug (auth logic error)
- Fix: Correct token validation
- Retry: npm test
❌ Still failing

Recovery Attempt 2:
- Alternative fix: Check middleware order
- Retry: npm test
✅ Pass → Continue

---

### Example 3: Escalation

```
Task: Deploy to production

L0 Check: npm run build
❌ Error: Memory limit exceeded

Recovery Attempt 1:
- Fix: Increase Node memory limit
- Retry: npm run build
❌ Still failing

Recovery Attempt 2:
- Alternative: Build in smaller chunks
- Retry: npm run build
❌ Still failing

Decision: ESCALATE
- Evidence: artifacts/build-error-*.log
- Recommendation: Need CI/CD with more memory
- Blocking: Yes, deployment blocked
```

---

## Metrics to Track

| Metric | Target |
|--------|--------|
| Auto-recovery rate | >70% |
| Escalation rate | <20% |
| Avg retries per failure | <1.5 |
| Time to recovery | <10min |

---

## Implementation Checklist

- [ ] Add this protocol to `dev-project-harness-loop/SKILL.md`
- [ ] Create `artifacts/` directory structure
- [ ] Add failure classification helper script
- [ ] Test with real failures
- [ ] Track metrics
