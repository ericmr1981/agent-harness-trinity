#!/usr/bin/env bash
set -euo pipefail

# Scaffold a minimal agent-first project harness in the current directory.
# Safe by default: will NOT overwrite existing files.
# Usage: bash scaffold_harness.sh [--force]

FORCE=0
if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
fi

write_file() {
  local path="$1"; shift
  local content="$1"; shift
  if [[ -f "$path" && "$FORCE" -ne 1 ]]; then
    echo "[skip] $path exists"
    return 0
  fi
  mkdir -p "$(dirname "$path")"
  printf "%s" "$content" > "$path"
  echo "[write] $path"
}

if [[ -f "init.sh" && "$FORCE" -eq 1 ]]; then
  :
fi

write_file "CLAUDE.md" "# Project Mission (CLAUDE.md)\n\n## Mission\n- TODO\n\n## Acceptance target\n- TODO (must be verifiable)\n\n## Non-goals\n- TODO\n\n## Constraints\n- Keep changes bounded and reversible\n- Do not claim done without verification evidence\n"

write_file "AGENTS.md" "# AGENTS.md (index)\n\nKeep this file short (~100 lines).\n\n## Where to look\n- Mission + global rules: CLAUDE.md\n- Current progress: CHANGELOG.md\n- Structured checklist: features.json\n- Bootstrap: init.sh\n- Architecture rules: docs/architecture.md\n- Quality/tech debt: docs/quality.md\n\n## Default loop\n1) Read CLAUDE.md + CHANGELOG.md\n2) Pick one bounded bet\n3) Implement + verify\n4) Commit + log (include commit hash)\n"

write_file "CHANGELOG.md" "# Progress Log\n\nUse one entry per bounded iteration. Include failures.\n\n"

write_file "features.json" "[\n  {\n    \"id\": \"F-001\",\n    \"title\": \"TODO: first feature\",\n    \"passes\": false,\n    \"verify\": \"TODO: command or manual oracle\"\n  }\n]\n"

write_file "harness.json" "{\n  \"initCommand\": \"bash init.sh\",\n  \"testCommand\": \"\",\n  \"e2eCommand\": \"\",\n  \"acceptanceSummary\": \"TODO\"\n}\n"

write_file "HARNESS_LINKS.md" "# Harness links\n\n- repoRoot: $(pwd)\n- externalRecordRoot: TODO (optional, e.g. Obsidian path)\n"

write_file "docs/architecture.md" "# Architecture rules\n\nDefine dependency direction rules that can be checked mechanically.\n\nExample:\n- types -> repo -> service -> ui\n"

write_file "docs/quality.md" "# Quality / tech debt\n\nTrack known issues, flakiness, and quality ratings.\n"

write_file "init.sh" "#!/usr/bin/env bash\nset -euo pipefail\n\necho \"TODO: install deps / start services / run smoke test\"\n"

chmod +x init.sh || true

mkdir -p scripts tests plans

if [[ ! -f "scripts/run_drift_check.sh" ]]; then
  echo "[hint] add guard scripts: scripts/run_drift_check.sh and scripts/run_change_guard.sh"
fi

echo "Done. Next: fill CLAUDE.md acceptance + harness.json commands, then add a runnable test oracle."