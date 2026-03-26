#!/usr/bin/env bash
set -euo pipefail

# Scaffolds/Upgrades a project record-system directory.
# Usage:
#   bash scaffold_project_harness.sh /path/to/project-record-root

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/project-record-root" >&2
  exit 2
fi

ROOT="$1"
mkdir -p "$ROOT"

# Create minimal docs if missing
[[ -f "$ROOT/Map.md" ]] || cat > "$ROOT/Map.md" <<'EOF'
# Project Map

- Goal:
- Key paths:
- How to verify:
- Guard commands:
  - bash scripts/run_change_guard.sh
EOF

[[ -f "$ROOT/ProjectTasks.md" ]] || cat > "$ROOT/ProjectTasks.md" <<'EOF'
# ProjectTasks

## Tasks

## Acceptance / DoD

## Change Log

| Date | Change | Verification |
|------|--------|--------------|
EOF

[[ -f "$ROOT/Summary.md" ]] || cat > "$ROOT/Summary.md" <<'EOF'
# <ProjectName> — Summary

> 建议使用 project-harness-guards 的“pretty summary”模板（类似 oa-cli 项目的 Summary）。
> 如需重写成标准结构：
> `bash scripts/standardize_summary.sh "."`

## 📋 项目概述

(一句话 + 核心价值 + 当前状态)
EOF

[[ -f "$ROOT/Readme.md" ]] || cat > "$ROOT/Readme.md" <<'EOF'
# Readme

This directory is the single source of truth for project status, decisions, verification, and links.
EOF

# Recommended harness set
[[ -f "$ROOT/Invariants.md" ]] || cat > "$ROOT/Invariants.md" <<'EOF'
# Invariants

- Non-negotiable rules.
EOF

[[ -f "$ROOT/Harness_DoD.md" ]] || cat > "$ROOT/Harness_DoD.md" <<'EOF'
# Harness DoD

- Every change must update ProjectTasks change log with: what changed + verification method + result.
- Preferred: bash scripts/run_change_guard.sh
EOF

[[ -f "$ROOT/Runbook.md" ]] || cat > "$ROOT/Runbook.md" <<'EOF'
# Runbook

- SOP for triage/repair.
EOF

[[ -f "$ROOT/Doc_Gardening.md" ]] || cat > "$ROOT/Doc_Gardening.md" <<'EOF'
# Doc Gardening

- Any change must run guards.
EOF

# Install scripts into project directory
mkdir -p "$ROOT/scripts"

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

for f in drift_check.py log_guard.py run_drift_check.sh run_change_guard.sh require_project_updates.sh upgrade_existing_project.sh standardize_summary.sh; do
  install -m 755 "$SRC_DIR/$f" "$ROOT/scripts/$f"
done

echo "OK: scaffolded project harness in $ROOT"
