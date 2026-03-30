#!/usr/bin/env bash
# run_trinity_guard.sh — Trinity 自身质量守卫
#
# 检查 agent-harness-trinity 自身的 skill 目录结构完整性。
#
# 用法:
#   bash scripts/run_trinity_guard.sh
#   bash scripts/run_trinity_guard.sh --verbose
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERBOSE=0
if [[ "${1:-}" == "--verbose" || "${1:-}" == "-v" ]]; then
  VERBOSE=1
fi

ERRORS=0
WARNINGS=0

log_info()  { echo "  ℹ  $1"; }
log_pass()  { echo "  ✅ $1"; }
log_warn()  { echo "  ⚠️  $1"; ((WARNINGS++)) || true; }
log_fail()  { echo "  ❌ $1"; ((ERRORS++)) || true; }
header()    { echo ""; echo "🔍 $1"; echo "─────────────────────────────────────────────────"; }

# ──────────────────────────────────────────────────────────
# CHECK 1: Core skill directories + SKILL.md
# ──────────────────────────────────────────────────────────
run_check1() {
  header "CHECK 1: Core Skill Structure"
  local -a CORE_SKILLS=("dev-project-harness-loop" "dev-project-autoloop" "project-harness-guards")
  for skill in "${CORE_SKILLS[@]}"; do
    local SKILL_PATH="$REPO_ROOT/$skill/SKILL.md"
    if [[ -f "$SKILL_PATH" ]]; then
      log_pass "$skill/SKILL.md exists"
      if [[ "$VERBOSE" == "1" ]]; then
        log_info "  size: $(wc -c < "$SKILL_PATH") bytes"
      fi
    else
      log_fail "$skill/SKILL.md MISSING"
    fi
  done
}

# ──────────────────────────────────────────────────────────
# CHECK 2: Extension skills
# ──────────────────────────────────────────────────────────
run_check2() {
  header "CHECK 2: Extension Skills"
  # subagent-coding-lite lives at root level; others in skills/
  local -a EXT_SKILLS=("subagent-coding-lite:subagent-coding-lite/SKILL.md" "harness-dispatch:skills/harness-dispatch/SKILL.md" "agency-agents-lib:skills/agency-agents-lib/SKILL.md")
  for entry in "${EXT_SKILLS[@]}"; do
    local skill="${entry%%:*}"
    local relpath="${entry##*:}"
    local SKILL_PATH="$REPO_ROOT/$relpath"
    if [[ -f "$SKILL_PATH" ]]; then
      log_pass "$relpath exists"
    else
      log_warn "$relpath not found (optional)"
    fi
  done
}

# ──────────────────────────────────────────────────────────
# CHECK 3: harness.js
# ──────────────────────────────────────────────────────────
run_check3() {
  header "CHECK 3: harness.js"
  local HARNESS_JS="$REPO_ROOT/dev-project-harness-loop/scripts/harness.js"
  if [[ -f "$HARNESS_JS" ]]; then
    local version=$(grep -m1 'harness.js v' "$HARNESS_JS" | head -1 || echo "(version not found)")
    log_pass "harness.js found: $version"
    if [[ "$VERBOSE" == "1" ]]; then
      log_info "  lines: $(wc -l < "$HARNESS_JS")"
    fi
  else
    log_fail "harness.js MISSING"
  fi
}

# ──────────────────────────────────────────────────────────
# CHECK 4: Template files
# ──────────────────────────────────────────────────────────
run_check4() {
  header "CHECK 4: Templates"
  local -a TEMPLATES=(
    "subagent-coding-lite/TEMPLATE_BRIEF.md"
    "subagent-coding-lite/TEMPLATE_ASSIGNMENT.md"
    "subagent-coding-lite/TEMPLATE_HANDOFF.md"
    "dev-project-harness-loop/references/goal-contract-template.md"
    "dev-project-harness-loop/references/sprint-contract-template.md"
    "dev-project-harness-loop/references/assignment-header.md"
    "dev-project-harness-loop/references/qa-report-template.md"
  )
  for tmpl in "${TEMPLATES[@]}"; do
    if [[ -f "$REPO_ROOT/$tmpl" ]]; then
      log_pass "$tmpl"
    else
      log_fail "$tmpl MISSING"
    fi
  done
}

# ──────────────────────────────────────────────────────────
# CHECK 5: Guard scripts
# ──────────────────────────────────────────────────────────
run_check5() {
  header "CHECK 5: Guard Scripts"
  local -a GUARD_SCRIPTS=(
    "project-harness-guards/scripts/scaffold_harness.sh"
    "project-harness-guards/scripts/run_change_guard.sh"
    "project-harness-guards/scripts/run_drift_check.sh"
  )
  for script in "${GUARD_SCRIPTS[@]}"; do
    if [[ -f "$REPO_ROOT/$script" ]]; then
      log_pass "$script"
    else
      log_fail "$script MISSING"
    fi
  done
}

# ──────────────────────────────────────────────────────────
# CHECK 6: Install script
# ──────────────────────────────────────────────────────────
run_check6() {
  header "CHECK 6: Install Script"
  local INSTALLER="$REPO_ROOT/scripts/install_skills.sh"
  if [[ -f "$INSTALLER" ]]; then
    log_pass "scripts/install_skills.sh exists"
  else
    log_fail "scripts/install_skills.sh MISSING"
  fi
}

# ──────────────────────────────────────────────────────────
# CHECK 7: Key references
# ──────────────────────────────────────────────────────────
run_check7() {
  header "CHECK 7: Key References"
  local -a REFS=(
    "dev-project-harness-loop/references/minimal-flow-example.md"
    "dev-project-harness-loop/references/harness-profiles.md"
    "dev-project-harness-loop/references/failure-recovery-protocol.md"
    "dev-project-harness-loop/references/auto-resume-protocol.md"
  )
  for ref in "${REFS[@]}"; do
    if [[ -f "$REPO_ROOT/$ref" ]]; then
      log_pass "$ref"
    else
      log_fail "$ref MISSING"
    fi
  done
}

# ──────────────────────────────────────────────────────────
# CHECK 8: agency-agents-lib agents
# ──────────────────────────────────────────────────────────
run_check8() {
  header "CHECK 8: agency-agents-lib"
  local ENG_DIR="$REPO_ROOT/skills/agency-agents-lib/agents/engineering"
  local DES_DIR="$REPO_ROOT/skills/agency-agents-lib/agents/design"
  if [[ -d "$ENG_DIR" ]]; then
    local eng_count
    eng_count=$(find "$ENG_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    log_pass "engineering agents: $eng_count files"
  else
    log_warn "skills/agency-agents-lib/agents/engineering/ not found"
  fi
  if [[ -d "$DES_DIR" ]]; then
    local des_count
    des_count=$(find "$DES_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    log_pass "design agents: $des_count files"
  else
    log_warn "skills/agency-agents-lib/agents/design/ not found"
  fi
}

# ──────────────────────────────────────────────────────────
# CHECK 9: Documentation
# ──────────────────────────────────────────────────────────
run_check9() {
  header "CHECK 9: Documentation"
  local -a DOCS=("README.md" "MAP.md")
  for doc in "${DOCS[@]}"; do
    if [[ -f "$REPO_ROOT/$doc" ]]; then
      log_pass "$doc"
    else
      log_fail "$doc MISSING"
    fi
  done
}

# ──────────────────────────────────────────────────────────
# CHECK 10: TEMPLATE_BRIEF merge
# ──────────────────────────────────────────────────────────
run_check10() {
  header "CHECK 10: TEMPLATE_BRIEF Merge"
  local BRIEF="$REPO_ROOT/subagent-coding-lite/TEMPLATE_BRIEF.md"
  if [[ -f "$BRIEF" ]]; then
    local v
    v=$(grep -m1 '版本.*v[0-9]' "$BRIEF" | head -1 || echo "vunknown")
    log_pass "TEMPLATE_BRIEF.md: $v"
    if grep -q 'assignment.*handoff.*合并' "$BRIEF" 2>/dev/null; then
      log_pass "  merge confirmed (assignment + handoff in one file)"
    fi
  else
    log_fail "TEMPLATE_BRIEF.md MISSING"
  fi
}

# ──────────────────────────────────────────────────────────
# CHECK 11: harness.js v4 features
# ──────────────────────────────────────────────────────────
run_check11() {
  header "CHECK 11: harness.js v4 Features"
  local HARNESS_JS="$REPO_ROOT/dev-project-harness-loop/scripts/harness.js"
  if [[ ! -f "$HARNESS_JS" ]]; then
    log_fail "harness.js missing — cannot check features"
    return
  fi
  if grep -q 'computeComplexity' "$HARNESS_JS" 2>/dev/null; then
    log_pass "Complexity scoring card (computeComplexity)"
  else
    log_fail "Complexity scoring card MISSING"
  fi
  if grep -q 'agencyDecisionTree' "$HARNESS_JS" 2>/dev/null; then
    log_pass "Agency agent decision tree (agencyDecisionTree)"
  else
    log_fail "Agency decision tree MISSING"
  fi
  if grep -q 'scoreToAttachmentTier\|attachmentTier' "$HARNESS_JS" 2>/dev/null; then
    log_pass "Selective attachments (attachmentTier)"
  else
    log_fail "Selective attachments MISSING"
  fi
  if grep -q 'writePostTaskScaffold\|Post-Task Report' "$HARNESS_JS" 2>/dev/null; then
    log_pass "Post-task report generation"
  else
    log_fail "Post-task report MISSING"
  fi
  if grep -q 'tokenTrack' "$HARNESS_JS" 2>/dev/null; then
    log_pass "Token tracking"
  else
    log_fail "Token tracking MISSING"
  fi
  if grep -qE "'minimal'.*'keyword'.*'llm'" "$HARNESS_JS" 2>/dev/null; then
    log_pass "Mode分级 (minimal/keyword/llm/llm-full)"
  else
    log_fail "Mode分级 MISSING"
  fi
}

# ──────────────────────────────────────────────────────────
# RUN ALL CHECKS
# ──────────────────────────────────────────────────────────
main() {
  run_check1
  run_check2
  run_check3
  run_check4
  run_check5
  run_check6
  run_check7
  run_check8
  run_check9
  run_check10
  run_check11

  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "📊 TRINITY GUARD SUMMARY"
  echo "═══════════════════════════════════════════════════════"
  echo "  ❌ Errors:   $ERRORS"
  echo "  ⚠️  Warnings: $WARNINGS"
  echo ""

  if [[ "$ERRORS" -gt 0 ]]; then
    echo "❌ GUARD FAILED — $ERRORS error(s) found"
    echo "   Fix the errors above before using this Trinity installation."
    exit 1
  elif [[ "$WARNINGS" -gt 0 ]]; then
    echo "⚠️  GUARD PASSED WITH WARNINGS — $WARNINGS warning(s)"
    exit 0
  else
    echo "✅ GUARD PASSED — Trinity installation is complete and valid"
    exit 0
  fi
}

main
