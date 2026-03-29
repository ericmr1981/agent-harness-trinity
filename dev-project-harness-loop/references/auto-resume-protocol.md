# Auto-Resume Protocol

## Purpose

Enable seamless session-to-session continuity without human coordination.

---

## Session Start Flow

```
┌─────────────────────────────────────────────────────────┐
│  New Session Starts                                     │
│    │                                                  │
│    ▼                                                  │
│  Step 1: Read ACTIVE.md                               │
│    │                                                  │
│    ├── Has running session?                           │
│    │   │                                              │
│    │   ├── Yes → Fetch session history                │
│    │   │         Extract handoff                      │
│    │   │         Resume from handoff                  │
│    │   │                                              │
│    │   └── No → Continue to Step 2                    │
│    │                                                  │
│    ▼                                                  │
│  Step 2: Read harness/contracts/ (latest)             │
│    │                                                  │
│    ▼                                                  │
│  Step 3: Read features.json                           │
│    │                                                  │
│    ▼                                                  │
│  Step 4: Read CHANGELOG.md (last entry)               │
│    │                                                  │
│    ▼                                                  │
│  Step 5: Run bash init.sh                             │
│    │                                                  │
│    ▼                                                  │
│  Step 6: Reconcile & Continue                         │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Parse ACTIVE.md

**File format**:
```markdown
# ACTIVE.md — Current WIP

## Current Project
- **Name**: Pipi-go
- **Task**: 移动端棋盘缩放功能
- **Started**: 2026-03-29T13:00:00Z
- **Session**: session_1711714920000
- **Status**: running | paused | blocked | completed
- **Last Handoff**: harness/handoffs/handoff-1711714920.md

## Next Bet
- **Objective**: Implement pinch-to-zoom gesture
- **Oracle**: npm run build && npm test
- **Evidence**: artifacts/pinch-zoom-demo.gif

## Blockers
- (if any)

---
*Last updated: 2026-03-29T14:00:00Z*
```

**Parsing logic**:
```javascript
async function parseActive() {
  const content = await readFile('ACTIVE.md', 'utf8');
  
  // Extract fields
  const session = content.match(/\*\*Session\*\*: (.+)/)?.[1];
  const status = content.match(/\*\*Status\*\*: (.+)/)?.[1];
  const handoff = content.match(/\*\*Last Handoff\*\*: (.+)/)?.[1];
  
  return { session, status, handoff };
}
```

---

## Step 2: Fetch Session History (if running)

**If status = "running" and session exists**:

```javascript
async function resumeFromSession(sessionId) {
  // Fetch session history
  const history = await sessions_history({
    sessionKey: sessionId,
    limit: 50,
    includeTools: true
  });
  
  // Find last handoff
  const lastHandoff = history.messages
    .filter(m => m.content.includes('## Handoff Packet'))
    .pop();
  
  if (lastHandoff) {
    // Extract handoff details
    const filesChanged = extractFilesChanged(lastHandoff);
    const evidence = extractEvidence(lastHandoff);
    const nextSteps = extractNextSteps(lastHandoff);
    
    return {
      type: 'session-resume',
      handoff: lastHandoff,
      filesChanged,
      evidence,
      nextSteps
    };
  }
  
  return null;
}
```

---

## Step 3: Read Harness Truth

**Always read these** (even if session resume succeeds):

```javascript
async function readHarnessTruth() {
  // Latest sprint contract
  const contracts = await glob('harness/contracts/*.md');
  const latestContract = contracts.sort().pop();
  const contractContent = await readFile(latestContract, 'utf8');
  
  // Features state
  const features = JSON.parse(await readFile('features.json', 'utf8'));
  const unfinishedFeatures = features.features.filter(f => !f.passes);
  
  // Last changelog entry
  const changelog = await readFile('CHANGELOG.md', 'utf8');
  const lastEntry = changelog.split('##')[1]; // Get first section
  
  return {
    contract: { path: latestContract, content: contractContent },
    features: { unfinished: unfinishedFeatures },
    changelog: { last: lastEntry }
  };
}
```

---

## Step 4: Reconcile

**Decision logic**:

```javascript
async function reconcile(sessionResume, harnessTruth) {
  if (sessionResume) {
    // Continue from session handoff
    console.log(`📍 Resuming from session ${sessionResume.session}`);
    console.log(`   Last task: ${sessionResume.nextSteps[0]}`);
    
    return {
      mode: 'continue',
      task: sessionResume.nextSteps[0],
      context: sessionResume.handoff
    };
  }
  
  // No session, resume from harness
  if (harnessTruth.features.unfinished.length > 0) {
    const nextFeature = harnessTruth.features.unfinished[0];
    
    console.log(`📍 Resuming from harness`);
    console.log(`   Next feature: ${nextFeature.title}`);
    
    return {
      mode: 'harness-resume',
      task: `Implement: ${nextFeature.title}`,
      context: harnessTruth.contract.content
    };
  }
  
  // All features done, check for new goals
  console.log(`✅ All features complete, awaiting new goal`);
  
  return {
    mode: 'awaiting-goal',
    task: null
  };
}
```

---

## Step 5: Environment Check

**Always run before resuming work**:

```bash
# init.sh
#!/bin/bash

echo "🔍 Checking environment..."

# Check Node version
node_version=$(node -v)
if [[ ! $node_version =~ ^v2[0-9] ]]; then
  echo "⚠️  Warning: Node version $node_version, expected v20+"
fi

# Check dependencies
npm ls --depth=0 > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Run build
npm run build > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ Build failed, checking..."
  npm run build
  exit 1
fi

echo "✅ Environment ready"
```

---

## Session End Protocol

**At end of each session**, create handoff:

```markdown
# Handoff Packet

## Session Info
- **Session ID**: session_1711714920000
- **End Time**: 2026-03-29T14:00:00Z
- **Status**: completed | paused | blocked

## What Was Done
- Files changed: 5
- Features completed: 1
- Tests added: 3

## Evidence
- Build: ✅ `npm run build` passed
- Tests: ✅ `npm test` passed (98% coverage)
- Manual: ✅ Tested pinch-to-zoom on mobile

## Next Steps
1. Implement double-tap to reset zoom
2. Add zoom level indicator
3. Test on iOS Safari

## Known Issues
- (if any)

## Context for Next Session
- Current sprint: sprint-20260329-001
- Goal: Mobile-friendly board interaction
- Blockers: None
```

**Save to**: `harness/handoffs/handoff-<timestamp>.md`

---

## ACTIVE.md Update Format

**Update at session end**:

```javascript
async function updateActive(project, task, session, status, handoff) {
  const content = `# ACTIVE.md — Current WIP

## Current Project
- **Name**: ${project.name}
- **Task**: ${task}
- **Started**: ${new Date().toISOString()}
- **Session**: ${session || 'N/A'}
- **Status**: ${status}
- **Last Handoff**: ${handoff || 'N/A'}

## Next Bet
- **Objective**: (next bounded task)
- **Oracle**: (verification command)
- **Evidence**: (artifact path)

## Blockers
- (if any)

---
*Last updated: ${new Date().toISOString()}*
`;

  await writeFile('ACTIVE.md', content);
}
```

---

## Examples

### Example 1: Session Resume (Normal)

```
Session A ends:
- Status: running
- Handoff: harness/handoffs/handoff-1711714920.md
- Next: Implement double-tap reset

Session B starts:
1. Read ACTIVE.md → session=session_1711714920000, status=running
2. Fetch session history → Extract handoff
3. Read handoff → Next task: double-tap reset
4. Resume implementation

Output:
📍 Resuming from session session_1711714920000
   Last task: Implement double-tap to reset zoom
   Continuing from handoff...
```

---

### Example 2: Harness Resume (Session Expired)

```
Session A ends:
- Status: paused (session expired)

Session B starts (days later):
1. Read ACTIVE.md → session=session_old, status=paused
2. Fetch session history → Failed (session not found)
3. Read harness/contracts/ → Latest: sprint-20260329-001
4. Read features.json → Unfinished: "double-tap reset"
5. Resume from harness

Output:
📍 Resuming from harness
   Next feature: double-tap reset
   Continuing from sprint contract...
```

---

### Example 3: Fresh Start (No Active Project)

```
Session starts:
1. Read ACTIVE.md → File doesn't exist or empty
2. Read harness/contracts/ → No contracts
3. Read features.json → All features pass=true

Output:
✅ No active project
   Awaiting new goal from human...
```

---

## Implementation Checklist

- [ ] Add auto-resume logic to `dev-project-harness-loop/SKILL.md`
- [ ] Create `harness/handoffs/` directory
- [ ] Add session end handoff template
- [ ] Add ACTIVE.md update function
- [ ] Test with real session transitions
- [ ] Add metrics tracking (resume success rate)

---

## Metrics to Track

| Metric | Target |
|--------|--------|
| Auto-resume success rate | >90% |
| Time to resume | <30s |
| Session-to-harness fallback | <10% |
| Human coordination needed | <5% |
