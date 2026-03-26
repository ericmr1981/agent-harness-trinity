#!/usr/bin/env bash
set -euo pipefail

# Install the Trinity skills into an OpenClaw agent workspace.
#
# Usage:
#   bash scripts/install_skills.sh --agent <agent-id> [--with-subagent-lite]
#   bash scripts/install_skills.sh --dest <absolute/path/to/workspace/skills> [--with-subagent-lite]
#
# Examples:
#   bash scripts/install_skills.sh --agent jarvis
#   bash scripts/install_skills.sh --agent jarvis --with-subagent-lite
#   bash scripts/install_skills.sh --dest "$HOME/.openclaw/agents/jarvis/workspace/skills"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

AGENT_ID=""
DEST=""
WITH_SUBAGENT_LITE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)
      AGENT_ID="${2:-}"
      shift 2
      ;;
    --dest)
      DEST="${2:-}"
      shift 2
      ;;
    --with-subagent-lite)
      WITH_SUBAGENT_LITE=1
      shift
      ;;
    --help|-h)
      sed -n '1,120p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1"
      exit 2
      ;;
  esac
done

if [[ -n "$AGENT_ID" && -z "$DEST" ]]; then
  DEST="$HOME/.openclaw/agents/$AGENT_ID/workspace/skills"
fi

if [[ -z "$DEST" ]]; then
  echo "[FAIL] provide --agent <agent-id> or --dest <path>"
  exit 2
fi

mkdir -p "$DEST"

copy_dir() {
  local src="$1"; local dst="$2"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$src/" "$dst/"
  else
    rm -rf "$dst"
    cp -a "$src" "$dst"
  fi
}

skills=(
  "dev-project-autoloop"
  "project-harness-guards"
  "dev-project-harness-loop"
)

if [[ "$WITH_SUBAGENT_LITE" -eq 1 ]]; then
  skills+=("subagent-coding-lite")
fi

for s in "${skills[@]}"; do
  if [[ ! -d "$REPO_ROOT/$s" ]]; then
    echo "[FAIL] missing skill dir: $REPO_ROOT/$s"
    exit 3
  fi
  if [[ ! -f "$REPO_ROOT/$s/SKILL.md" ]]; then
    echo "[FAIL] missing SKILL.md: $REPO_ROOT/$s/SKILL.md"
    exit 3
  fi

dst="$DEST/$s"
  echo "[COPY] $s -> $dst"
  copy_dir "$REPO_ROOT/$s" "$dst"
done

echo "[OK] installed to: $DEST"
