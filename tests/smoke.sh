#!/usr/bin/env bash
set -euo pipefail

# Basic smoke test for agent-harness-trinity
echo "=== Trinity smoke test ==="

# 1. Check required files exist
echo "--- drift check ---"
required="CLAUDE.md AGENTS.md CHANGELOG.md features.json init.sh harness.json"
for f in $required; do
  if [[ ! -f "$f" ]]; then
    echo "[FAIL] missing: $f"
    exit 1
  fi
  echo "[OK] $f"
done

# 2. Node syntax check
echo "--- node --check ---"
find . -name '*.js' -not -path './node_modules/*' | while read -r f; do
  node --check "$f"
done
echo "[OK] all JS files pass"

# 3. init.sh runs
echo "--- bash init.sh ---"
bash init.sh
echo "[OK] init.sh passes"

echo "=== smoke test PASSED ==="
