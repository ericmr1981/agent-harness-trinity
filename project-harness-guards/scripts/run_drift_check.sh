#!/usr/bin/env bash
set -euo pipefail

# Drift check: verify harness files exist and progress log mentions HEAD commit.
# Usage: bash run_drift_check.sh

req_files=("CLAUDE.md" "AGENTS.md" "features.json" "init.sh")
missing=0
for f in "${req_files[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "[FAIL] missing: $f"
    missing=1
  fi
done

if [[ "$missing" -eq 1 ]]; then
  exit 2
fi

if ! python3 -c 'import json; json.load(open("features.json"))' >/dev/null 2>&1; then
  echo "[FAIL] features.json is not valid JSON"
  exit 3
fi

if [[ ! -x "init.sh" ]]; then
  echo "[WARN] init.sh not executable (chmod +x init.sh)"
fi

LOG_FILE=""
if [[ -f "CHANGELOG.md" ]]; then
  LOG_FILE="CHANGELOG.md"
elif [[ -f "claude-progress.txt" ]]; then
  LOG_FILE="claude-progress.txt"
fi

if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  HEAD_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "")
  if [[ -n "$LOG_FILE" && -n "$HEAD_SHA" ]]; then
    if ! grep -q "$HEAD_SHA" "$LOG_FILE"; then
      echo "[WARN] $LOG_FILE does not mention HEAD commit ($HEAD_SHA). Add an entry with: commit: $HEAD_SHA"
    fi
  fi
fi

echo "[OK] drift check passed"