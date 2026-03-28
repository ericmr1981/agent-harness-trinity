# Minimal Flow Example

Use this when you want the smallest realistic example of the Trinity loop.

Scenario:
- Goal: add a homepage project list to a web app
- Profile: `PGE-final`
- Roles: planner → builder → verifier

---

## 1) Goal contract

`harness/goal.md`

```md
# Goal Contract

## Final goal
- Homepage shows a project list with name, status, and click-through to detail page.

## Non-goals
- No pagination in this round.
- No project creation flow in this round.

## Approval boundaries
- Do not deploy.
- Do not change billing/auth settings.

## Reporting mode
- milestone-only

## Acceptance summary
- L1: npm test && npm run build
- L2:
  - Happy path: homepage loads list and click-through works
  - Edge path: empty-state message renders with no projects
```

## 2) Sprint contract

`harness/contracts/homepage-project-list.md`

```md
# Sprint Contract
- id: homepage-project-list
- harness profile: PGE-final

## Sprint goal
- Implement homepage project list UI and routing to detail page.

## Scope
- In scope:
  - homepage list rendering
  - empty state
  - click-through routing
- Out of scope:
  - pagination
  - server-side filtering

## Acceptance criteria
1. Homepage renders project cards with name and status.
2. Clicking a card opens the project detail page.
3. Empty project data shows a stable empty-state message.

## Verification plan
### L1
- npm test
- npm run build

### L2
- Scenario A: homepage with seeded data → list visible → click first card → detail page opens
- Scenario B: homepage with no data → empty-state visible and no crash
```

## 3) Assignment header

`harness/assignments/round-01.md`

```md
# Role
Role: builder
Why now: implementation is bounded and code-heavy

# Mission
Project: example-webapp
Round: round-01
Objective: implement homepage project list per contract
Harness profile: PGE-final

# Goal + Contract Pointers
- Goal: harness/goal.md
- Contract: harness/contracts/homepage-project-list.md

# Scope
In scope:
- src/pages/Home.tsx
- src/components/ProjectCard.tsx
- router config for detail page
Out of scope:
- pagination
- auth changes

# Capabilities
Allowed tools/actions:
- edit files
- run npm test
- run npm run build
May browse externally: no
May edit product code: yes
May edit harness docs: no
Must not:
- git commit / git push / remote changes

# Acceptance
Done means:
- homepage list renders correctly
- click-through works
- empty-state works
```

## 4) Builder handoff

`harness/handoff.md`

```md
# Handoff

## Why handoff
- subagent return

## Goal + current state
- goal contract: harness/goal.md
- repo status: feature/homepage-list, dirty
- last known good commit: abc1234
- what currently passes:
  - npm test
  - npm run build
- what currently fails:
  - verifier not yet run

## Facts
- Added ProjectCard component
- Homepage now maps project list data
- Added empty-state branch
- Added route link to project detail page

## Assessment
- current verdict: PARTIAL
- open issues / blockers:
  - verifier still needs browser walkthrough
- residual risks:
  - detail page route assumes project id always exists

## Recommendation
- next bounded bet:
  - run verifier pass on happy path + empty state
```

## 5) Verifier report

`harness/qa/homepage-project-list.md`

```md
# QA Report

## Verdict
- PASS

## Findings
- No blocker found
- Empty-state renders correctly
- Click-through works in browser walkthrough

## Coverage check
- Criterion 1 verified by homepage render + screenshot
- Criterion 2 verified by click-through walkthrough
- Criterion 3 verified by empty dataset check

## Residual risk
- Large lists still untested (out of scope)
```

## 6) Planner reconcile

After the verifier passes:
- update `features.json` for this feature to `passes: true`
- add `CHANGELOG.md` entry with commit hash + evidence
- choose the next unfinished task
- continue automatically unless blocked or approval boundary is hit

---

## Why this example matters

It demonstrates the intended information flow:
- human gives a goal once
- planner defines the contract
- builder implements one bounded round
- verifier independently judges it
- planner reconciles and keeps moving

The system should **not** stop merely because round-01 finished.
