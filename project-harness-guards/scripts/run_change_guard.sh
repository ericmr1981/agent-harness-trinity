#!/usr/bin/env bash
set -euo pipefail

# Change guard: drift check + run best available test command.
# Usage: bash run_change_guard.sh [--test "<cmd>"]

TEST_CMD=""
if [[ "${1:-}" == "--test" ]]; then
  TEST_CMD="${2:-}"
fi

bash "$(dirname "$0")/run_drift_check.sh"

# Discover test command.
if [[ -z "$TEST_CMD" && -f "harness.json" ]]; then
  # Read harness.json.testCommand via python to avoid jq dependency.
  TEST_CMD=$(python3 - <<'PY'
import json
try:
  with open('harness.json','r',encoding='utf-8') as f:
    j=json.load(f)
  print((j.get('testCommand') or '').strip())
except Exception:
  print('')
PY
)
fi

if [[ -z "$TEST_CMD" ]]; then
  if [[ -f "package.json" ]]; then
    TEST_CMD="npm test"
  elif [[ -f "pytest.ini" || -d "tests" ]]; then
    TEST_CMD="pytest -q"
  elif [[ -f "go.mod" ]]; then
    TEST_CMD="go test ./..."
  fi
fi

if [[ -z "$TEST_CMD" ]]; then
  echo "[WARN] no testCommand found. Set harness.json:testCommand or pass --test <cmd>."
  echo "[OK] change guard (no tests run)"
  exit 0
fi

echo "[RUN] $TEST_CMD"
set +e
bash -lc "$TEST_CMD"
code=$?
set -e

if [[ "$code" -ne 0 ]]; then
  echo "[FAIL] tests failed (exit=$code)"
  exit "$code"
fi

echo "[OK] change guard passed"