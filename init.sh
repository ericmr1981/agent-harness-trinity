#!/usr/bin/env bash
set -euo pipefail

echo "=== Trinity skill suite init ==="

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[FAIL] node not found"
  exit 1
fi
echo "[OK] node: $(node --version)"

# Check all skill JS files syntax
echo "--- Checking skill scripts ---"
find . -name '*.js' -not -path './node_modules/*' | while read -r f; do
  if ! node --check "$f" 2>/dev/null; then
    echo "[FAIL] syntax error: $f"
    exit 1
  fi
done
echo "[OK] all JS files pass node --check"

# Check scaffold script
if [[ -f "project-harness-guards/scripts/scaffold_harness.sh" ]]; then
  echo "[OK] scaffold_harness.sh present"
fi

echo "=== init done ==="
