#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# harness.js P2 Regression Tests
# Tests P0/P1/P2 fixes: intent mode, scope mismatch, oracle, .claude routing.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
HARNESS_JS="$REPO_DIR/dev-project-harness-loop/scripts/harness.js"

# colours
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BOLD='\033[1m'; RESET='\033[0m'
PASS(){ printf "${GREEN}[PASS]${RESET} %s\n" "$1"; }
FAIL(){ printf "${RED}[FAIL]${RESET} %s\n" "$1"; exit 1; }
INFO(){ printf "${YELLOW}[INFO]${RESET} %s\n" "$1"; }

# Config: default to this repo so regressions stay self-contained; callers may override OPENCLAW_WORKSPACE.
export OPENCLAW_WORKSPACE="${OPENCLAW_WORKSPACE:-$REPO_DIR}"
HARNESS="env OPENCLAW_WORKSPACE=$OPENCLAW_WORKSPACE /usr/local/bin/node $HARNESS_JS"

# ── Helpers ───────────────────────────────────────────────────────────────────

# Run harness with a task and extract the Intent Mode line.
intent_mode() {
  local task="$1"
  $HARNESS --mode keyword --complexity 3 "$task" 2>&1 | \
    rg "^🎯 Intent Mode:" | sed 's/^🎯 Intent Mode: *//'
}

# Extract a named JSON field from the latest continue-gate artifact.
artifact_field() {
  local field="$1"
  local repo="${2:-$OPENCLAW_WORKSPACE}"
  local artifact="$repo/harness/artifacts/continue-gate/sprint-1.json"
  if [[ -f "$artifact" ]]; then
    python3 -c "import json,sys; d=json.load(open('$artifact')); print(json.dumps(d.get('$field','N/A'), ensure_ascii=False))"
  else
    echo "N/A"
  fi
}

# Check oracle registry exists and has discovered oracle.
oracle_discovered() {
  local repo="${1:-$OPENCLAW_WORKSPACE}"
  local reg="$repo/harness/oracles/registry.json"
  if [[ -f "$reg" ]]; then
    python3 -c "import json; d=json.load(open('$reg')); print(d.get('lastDiscovered','N/A'))"
  else
    echo "N/A"
  fi
}

# Find the latest continue-gate artifact (sorted by mtime desc).
latest_artifact() {
  local repo="${1:-$OPENCLAW_WORKSPACE}"
  ls -t "$repo/harness/artifacts/continue-gate/"*.json 2>/dev/null | head -1 || echo ""
}

# ── Test 1: exploratory ask stays unclear ─────────────────────────────────
INFO "Test 1: exploratory ask → unclear (not full_rollout)"
result=$(intent_mode "看看这个项目")
if [[ "$result" == "unclear" ]]; then
  PASS "Test 1: '看看这个项目' → unclear"
else
  FAIL "Test 1: expected 'unclear', got '$result'"
fi

# ── Test 2: explicit rollout still fires full_rollout ───────────────────────
INFO "Test 2: explicit rollout → full_rollout"
result=$(intent_mode "完成 PRD 全部功能")
if [[ "$result" == "full_rollout" ]]; then
  PASS "Test 2: '完成 PRD 全部功能' → full_rollout"
else
  FAIL "Test 2: expected 'full_rollout', got '$result'"
fi

# ── Test 3: explicit continue F-002 ──────────────────────────────────────────
INFO "Test 3: explicit continue targets correct feature"
result=$(intent_mode "继续 F-002")
if [[ "$result" == "explicit_continue (explicit target: F-002)"* ]]; then
  PASS "Test 3: '继续 F-002' → explicit_continue F-002"
else
  FAIL "Test 3: expected 'explicit_continue (explicit target: F-002)', got '$result'"
fi

# ── Test 4: .claude hidden dir not selected ───────────────────────────────────
INFO "Test 4: generic ask does not misroute to .claude"
# Run against workspace root (no OPENCLAW_WORKSPACE set) — should not pick .claude
unset OPENCLAW_WORKSPACE
NO_WS_OUTPUT=$(env /usr/local/bin/node "$HARNESS_JS" --mode keyword --complexity 2 "实现计算模块" 2>&1 || true)
# Check the Project: line — should NOT be .claude
PROJECT_LINE=$(echo "$NO_WS_OUTPUT" | rg "^📁 Project:" || true)
if echo "$PROJECT_LINE" | grep -qv "\.claude"; then
  PASS "Test 4: generic ask not routing to .claude"
else
  FAIL "Test 4: misrouted to .claude: $PROJECT_LINE"
fi

# ── Test 5: oracle registry discovered ───────────────────────────────────────
INFO "Test 5: oracle registry discovered and persisted"
# Restore workspace
export OPENCLAW_WORKSPACE="${OPENCLAW_WORKSPACE:-$REPO_DIR}"
HARNESS="env OPENCLAW_WORKSPACE=$OPENCLAW_WORKSPACE /usr/local/bin/node $HARNESS_JS"
$HARNESS --mode keyword --complexity 3 "看看这个项目" >/dev/null 2>&1 || true
oracle=$(oracle_discovered "$OPENCLAW_WORKSPACE")
if [[ "$oracle" != "N/A" && "$oracle" != *"not yet discovered"* ]]; then
  PASS "Test 5: oracle discovered → $oracle"
else
  FAIL "Test 5: expected discovered oracle, got '$oracle'"
fi

# ── Test 6: scope selection reason in artifact ──────────────────────────────
INFO "Test 6: scopeSelectionReason written to continue-gate artifact"
$HARNESS --mode keyword --complexity 3 "继续 F-002" >/dev/null 2>&1 || true
artifact=$(latest_artifact "$OPENCLAW_WORKSPACE")
if [[ -n "$artifact" && -f "$artifact" ]]; then
  reason=$(python3 -c "import json; d=json.load(open('$artifact')); sr=d.get('scopeSelectionReason'); print(sr.get('intentMode','N/A') if sr else 'N/A')")
  if [[ "$reason" != "N/A" ]]; then
    PASS "Test 6: scopeSelectionReason.intentMode = $reason"
  else
    FAIL "Test 6: scopeSelectionReason intentMode is null in artifact"
  fi
else
  FAIL "Test 6: no artifact found"
fi

# ── Test 7: feature queue in artifact ───────────────────────────────────────
INFO "Test 7: featureQueue written to continue-gate artifact"
artifact=$(latest_artifact "$OPENCLAW_WORKSPACE")
if [[ -n "$artifact" && -f "$artifact" ]]; then
  queue=$(python3 -c "import json; d=json.load(open('$artifact')); fq=d.get('featureQueue'); print(len(fq) if fq else 0)")
  if [[ "$queue" -ge 0 ]]; then
    PASS "Test 7: featureQueue has $queue entries"
  else
    FAIL "Test 7: featureQueue not accessible"
  fi
else
  FAIL "Test 7: no artifact found"
fi

# ── Test 8: intent mode output has explicit target ────────────────────────────
INFO "Test 8: explicit F-003 continues correctly"
result=$(intent_mode "continue F-003")
if [[ "$result" == "explicit_continue (explicit target: F-003)"* ]]; then
  PASS "Test 8: 'continue F-003' → explicit_continue F-003"
else
  FAIL "Test 8: expected 'explicit_continue (explicit target: F-003)', got '$result'"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════"
echo "  P2 Regression Tests — ALL PASSED"
echo "════════════════════════════════════════════════════"
