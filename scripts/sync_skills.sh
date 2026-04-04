#!/usr/bash
# sync_skills.sh — Check & sync Trinity skill files against GitHub
#
# Usage:
#   bash scripts/sync_skills.sh                          # check jarvis workspace skills
#   bash scripts/sync_skills.sh --dry-run                # show what would change
#   bash scripts/sync_skills.sh --sync                   # check and update
#   bash scripts/sync_skills.sh --sync --force            # sync even if unchanged
#   bash scripts/sync_skills.sh --agent <agent-id>        # sync different agent's workspace
#   bash scripts/sync_skills.sh --global                  # sync global OpenClaw skills
#   bash scripts/sync_skills.sh --sync --global           # update global skills
#
# Version strategy:
#   Each installed file has a version comment in the first line:
#   <!-- SYNCTAG: 0bcb47b -->
#   The script compares this against the latest GitHub commit SHA for that file.
#
# Manifest format (per skill, see MANIFEST below):
#   Each entry: local_path | repo_source_path | category

set -uo pipefail

AGENT_ID="jarvis"
GLOBAL_SKILLS_ROOT="/usr/local/lib/node_modules/openclaw/skills"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT_ID="${AGENT_ID:-jarvis}"
GLOBAL_SKILLS_ROOT="/usr/local/lib/node_modules/openclaw/skills"
SKILLS_ROOT="${SKILLS_ROOT:-"$HOME/.openclaw/agents/$AGENT_ID/workspace/skills"}"
GITHUB_REPO="ericmr1981/agent-harness-trinity"
GITHUB_RAW="https://raw.githubusercontent.com/$GITHUB_REPO"
GITHUB_BRANCH="main"

DRY_RUN=false
SYNC=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --sync)    SYNC=true; shift ;;
    --force)   FORCE=true; shift ;;
    --agent)
      AGENT_ID="${2:-}"
      SKILLS_ROOT="$HOME/.openclaw/agents/$AGENT_ID/workspace/skills"
      shift 2
      ;;
    --global)
      SKILLS_ROOT="$GLOBAL_SKILLS_ROOT"
      shift
      ;;
    --help|-h)
      sed -n '1,20p' "$0"
      exit 0
      ;;
    *) echo "Unknown: $1"; exit 2 ;;
  esac
done

# ─────────────────────────────────────────────────────────────
# 1. Get latest commit SHA for the repo
# ─────────────────────────────────────────────────────────────
get_latest_sha() {
  # Try gh first, fall back to curl
  if sha=$(gh api "repos/$GITHUB_REPO/commits/$GITHUB_BRANCH" --jq '.sha' 2>/dev/null) && [[ -n "$sha" ]]; then
    echo "$sha"
    return 0
  fi
  # Fallback: curl GitHub API (no auth required for public repos)
  sha=$(curl -sf --max-time 10 "https://api.github.com/repos/$GITHUB_REPO/commits/$GITHUB_BRANCH" 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin)["sha"])' 2>/dev/null)
  if [[ -n "$sha" ]]; then
    echo "$sha"
    return 0
  fi
  return 1
}

# ─────────────────────────────────────────────────────────────
# 2. Read version tag from a file (first line matching SYNCTAG)
# ─────────────────────────────────────────────────────────────
get_local_version() {
  local file="$1"
  if [[ ! -f "$file" ]]; then echo "not-installed"; return; fi
  local tag
  tag=$(grep -m1 'SYNCTAG:' "$file" 2>/dev/null | sed 's/.*SYNCTAG: //' | tr -d ' ')
  if [[ -z "$tag" ]]; then
    echo "untagged"
  else
    # Always return 7-char short SHA for comparison
    echo "${tag:0:7}"
  fi
}

# ─────────────────────────────────────────────────────────────
# 3. Inject / update SYNCTAG comment at top of file (after frontmatter or shebang)
# ─────────────────────────────────────────────────────────────
update_synctag() {
  local file="$1"
  local sha="$2"
  local tag="<!-- SYNCTAG: $sha -->"

  if [[ ! -f "$file" ]]; then return; fi

  # Remove existing SYNCTAG lines
  local tmp
  tmp=$(mktemp)
  grep -v 'SYNCTAG:' "$file" > "$tmp" || true
  mv "$tmp" "$file"

  # Insert at top (after shebang / frontmatter if present)
  if head -1 "$file" | grep -q '^#!/'; then
    # After shebang
    local line
    line=$(head -1 "$file")
    tail -n +2 "$file" > "$tmp" || true
    printf '%s\n%s\n' "$line" "$tag" > "$file"
    cat "$tmp" >> "$file"
    rm -f "$tmp"
  elif head -1 "$file" | grep -q '^---'; then
    # YAML frontmatter — insert after closing --- line
    local afterFm
    afterFm=$(awk '/^---$/{c++;if(c==1)next} c==1{print;next} !c{print;exit}' "$file")
    local fmEndLine
    fmEndLine=$(awk '/^---$/{c++} c==1{print NR; exit}' "$file")
    if [[ -n "$fmEndLine" ]]; then
      head -n "$fmEndLine" "$file" > "$tmp"
      printf '%s\n' "$tag" >> "$tmp"
      tail -n +$((fmEndLine + 1)) "$file" >> "$tmp"
      mv "$tmp" "$file"
    else
      printf '%s\n' "$tag" | cat - "$file" > "$tmp" && mv "$tmp" "$file"
    fi
  else
    printf '%s\n' "$tag" | cat - "$file" > "$tmp" && mv "$tmp" "$file"
  fi
}

# ─────────────────────────────────────────────────────────────
# 4. Download a single file from GitHub raw
# ─────────────────────────────────────────────────────────────
download_file() {
  local repo_path="$1"
  local local_path="$2"
  local sha="$3"

  local url="${GITHUB_RAW}/${sha}/${repo_path}"
  local tmp
  tmp=$(mktemp)

  if curl -sfL --max-time 20 "$url" -o "$tmp" 2>/dev/null; then
    if [[ -s "$tmp" ]]; then
      mkdir -p "$(dirname "$local_path")"
      mv "$tmp" "$local_path"
      update_synctag "$local_path" "$sha"
      echo "  ✅ synced: $local_path"
      return 0
    fi
  fi
  rm -f "$tmp"
  echo "  ❌ failed: $repo_path"
  return 1
}

# ─────────────────────────────────────────────────────────────
# MANIFEST — all files tracked by this script
# Format: local_path | repo_source_path | category
# ─────────────────────────────────────────────────────────────
MANIFEST="
dev-project-harness-loop/SKILL.md             | dev-project-harness-loop/SKILL.md             | core
dev-project-harness-loop/scripts/harness.js   | dev-project-harness-loop/scripts/harness.js | core
dev-project-harness-loop/SKILL-CLI.md         | dev-project-harness-loop/SKILL-CLI.md       | core
dev-project-harness-loop/scripts/context-assembler/context-assembler.js | dev-project-harness-loop/scripts/context-assembler/context-assembler.js | core
dev-project-autoloop/SKILL.md                 | dev-project-autoloop/SKILL.md               | core
project-harness-guards/SKILL.md               | project-harness-guards/SKILL.md             | core
project-harness-guards/scripts/scaffold_harness.sh | project-harness-guards/scripts/scaffold_harness.sh | core
project-harness-guards/scripts/run_change_guard.sh | project-harness-guards/scripts/run_change_guard.sh | core
project-harness-guards/scripts/run_drift_check.sh  | project-harness-guards/scripts/run_drift_check.sh  | core
subagent-coding-lite/SKILL.md                 | subagent-coding-lite/SKILL.md               | optional
subagent-coding-lite/TEMPLATE_BRIEF.md       | subagent-coding-lite/TEMPLATE_BRIEF.md     | optional
subagent-coding-lite/TEMPLATE_HANDOFF.md      | subagent-coding-lite/TEMPLATE_HANDOFF.md    | optional
harness-dispatch/SKILL.md                                      | skills/harness-dispatch/SKILL.md                                      | harness
harness-dispatch/references/harness.js                         | skills/harness-dispatch/references/harness.js                         | harness
agency-agents-lib/SKILL.md                                     | skills/agency-agents-lib/SKILL.md                                     | optional
agency-agents-lib/README.md                                    | skills/agency-agents-lib/README.md                                    | optional
agency-agents-lib/INTEGRATION_REPORT.md                        | skills/agency-agents-lib/INTEGRATION_REPORT.md                        | optional
agency-agents-lib/index.json                                    | skills/agency-agents-lib/index.json                                    | optional
agency-agents-lib/agents/engineering/engineering-frontend-developer.md  | skills/agency-agents-lib/agents/engineering/engineering-frontend-developer.md  | optional
agency-agents-lib/agents/engineering/engineering-backend-architect.md   | skills/agency-agents-lib/agents/engineering/engineering-backend-architect.md   | optional
agency-agents-lib/agents/engineering/engineering-senior-developer.md     | skills/agency-agents-lib/agents/engineering/engineering-senior-developer.md     | optional
agency-agents-lib/agents/engineering/engineering-ai-engineer.md         | skills/agency-agents-lib/agents/engineering/engineering-ai-engineer.md         | optional
agency-agents-lib/agents/engineering/engineering-devops-automator.md    | skills/agency-agents-lib/agents/engineering/engineering-devops-automator.md    | optional
agency-agents-lib/agents/engineering/engineering-security-engineer.md    | skills/agency-agents-lib/agents/engineering/engineering-security-engineer.md    | optional
agency-agents-lib/agents/engineering/engineering-database-optimizer.md   | skills/agency-agents-lib/agents/engineering/engineering-database-optimizer.md   | optional
agency-agents-lib/agents/engineering/engineering-data-engineer.md       | skills/agency-agents-lib/agents/engineering/engineering-data-engineer.md       | optional
agency-agents-lib/agents/engineering/engineering-mobile-app-builder.md   | skills/agency-agents-lib/agents/engineering/engineering-mobile-app-builder.md   | optional
agency-agents-lib/agents/engineering/engineering-software-architect.md  | skills/agency-agents-lib/agents/engineering/engineering-software-architect.md  | optional
agency-agents-lib/agents/engineering/engineering-technical-writer.md     | skills/agency-agents-lib/agents/engineering/engineering-technical-writer.md     | optional
agency-agents-lib/agents/engineering/engineering-incident-response-commander.md | skills/agency-agents-lib/agents/engineering/engineering-incident-response-commander.md | optional
agency-agents-lib/agents/engineering/engineering-code-reviewer.md        | skills/agency-agents-lib/agents/engineering/engineering-code-reviewer.md        | optional
agency-agents-lib/agents/design/design-ui-designer.md                   | skills/agency-agents-lib/agents/design/design-ui-designer.md                   | optional
agency-agents-lib/agents/design/design-ux-researcher.md                  | skills/agency-agents-lib/agents/design/design-ux-researcher.md                  | optional
dev-project-harness-loop/references/sprint-contract-template.md       | dev-project-harness-loop/references/sprint-contract-template.md       | core
dev-project-harness-loop/references/qa-report-template.md              | dev-project-harness-loop/references/qa-report-template.md              | core
"

# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────
echo ""
echo "🔍 Trinity Skill Sync Checker"
echo "   Repo:       $GITHUB_REPO ($GITHUB_BRANCH)"
echo "   Skills:     $SKILLS_ROOT"
echo "   Agent:      $AGENT_ID"
echo "   Mode:       $($DRY_RUN && echo "DRY-RUN" || echo "LIVE")"
echo ""

# Get latest SHA
echo "📡 Fetching latest commit SHA..."
LATEST_SHA=$(get_latest_sha) || {
  echo "❌ Could not fetch latest SHA from GitHub. Check network or 'gh auth'."
  exit 1
}
LATEST_SHORT="${LATEST_SHA:0:7}"
echo "   Latest: $LATEST_SHORT"
echo ""

# Status counters (simple variables for bash 3 compatibility)
count_up_to_date=0
count_behind=0
count_not_installed=0
count_untagged=0
count_error=0

echo "┌─────────────────────────────────────────────────────────────┐"
printf "│ %-20s │ %-8s │ %-7s │ %-7s │ %-12s │\n" "FILE" "LOCAL_VER" "REMOTE" "STATUS" "ACTION"
echo "├─────────────────────────────────────────────────────────────┤"

errors=()

# Read manifest (skip first empty line)
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  # Skip comment lines
  [[ "$line" =~ ^# ]] && continue

  # Parse: local_path | repo_path | category
  local_path=$(echo "$line" | awk -F'|' '{print $1}' | xargs)
  repo_path=$(echo "$line" | awk -F'|' '{print $2}' | xargs)
  category=$(echo "$line" | awk -F'|' '{print $3}' | xargs)

  [[ -z "$local_path" ]] && continue

  # Expand tilde
  local_path_expanded="${local_path/#\~/$HOME}"
  full_local="$SKILLS_ROOT/$local_path_expanded"

  local_ver=$(get_local_version "$full_local")
  remote_ver="$LATEST_SHORT"

  # Determine status
  if [[ "$local_ver" == "not-installed" ]]; then
    status="not-installed"
    count_not_installed=$((count_not_installed + 1))
    action="${SYNC:+$(if $DRY_RUN; then echo "install (dry)"; else echo "install"; fi)}"
    if [[ "$SYNC" == "true" ]] && ! $DRY_RUN; then
      download_file "$repo_path" "$full_local" "$LATEST_SHA" && : || count_error=$((count_error + 1))
    fi
  elif [[ "$local_ver" == "untagged" ]]; then
    status="untagged"
    count_untagged=$((count_untagged + 1))
    action="${FORCE:+$(if $DRY_RUN; then echo "force (dry)"; else echo "force"; fi)}"
    if [[ "$SYNC" == "true" && "$FORCE" == "true" ]] && ! $DRY_RUN; then
      download_file "$repo_path" "$full_local" "$LATEST_SHA" && : || count_error=$((count_error + 1))
    fi
  elif [[ "$local_ver" == "$LATEST_SHORT" ]]; then
    status="✅ up-to-date"
    count_up_to_date=$((count_up_to_date + 1))
    action="—"
  else
    status="🔄 behind"
    count_behind=$((count_behind + 1))
    action="${SYNC:+$(if $DRY_RUN; then echo "update (dry)"; else echo "update"; fi)}"
    if [[ "$SYNC" == "true" ]] && ! $DRY_RUN; then
      download_file "$repo_path" "$full_local" "$LATEST_SHA" && : || count_error=$((count_error + 1))
    fi
  fi

  printf "│ %-20s │ %-8s │ %-7s │ %-12s │ %-12s │\n" \
    "$local_path" "$local_ver" "$remote_ver" "$status" "$action"

done <<< "$MANIFEST"

echo "└─────────────────────────────────────────────────────────────┘"

echo ""
echo "📊 Summary:"
echo "   ✅ up-to-date:  $count_up_to_date"
echo "   🔄 behind:      $count_behind"
echo "   not installed: $count_not_installed"
echo "   untagged:      $count_untagged"
echo "   ❌ errors:      $count_error"
echo ""

needs_sync=$((count_behind + count_not_installed + count_untagged))
if (( needs_sync > 0 )) && ! $SYNC; then
  echo "💡 Run with --sync to update outdated files:"
  echo "   bash scripts/sync_skills.sh --sync"
fi

if $SYNC; then
  if (( count_error > 0 )); then
    echo ""
    echo "⚠️  $count_error file(s) failed to download."
    exit 1
  else
    echo "✅ Sync complete. All files updated to $LATEST_SHORT."
  fi
fi
