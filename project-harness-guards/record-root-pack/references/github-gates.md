# GitHub gates (PR + CI)

Goal: make it mechanically hard to merge changes without updating project records.

## 1) PR template

Create:
- `.github/pull_request_template.md`

Template idea (minimal):
- [ ] Updated `ProjectTasks.md` (change log + verification)
- [ ] Ran change guard (`run_change_guard.sh` or equivalent)
- [ ] If invariants impacted: updated `Invariants.md` / `Harness_DoD.md`

A ready template is provided in `assets/templates/pull_request_template.md`.

## 2) GitHub Actions gate

Add workflow to run on PR:
- check that `ProjectTasks.md` is modified when code/config/scripts change
- optionally run `run_drift_check.sh` (if repo includes the project record root)

A ready workflow is provided in `assets/templates/github_actions_harness_guards.yml`.

## 3) Local pre-commit hook (optional)

- Add `scripts/require_project_updates.sh` to your repo and call it from `.git/hooks/pre-commit`.

Example pre-commit:
```bash
#!/usr/bin/env bash
set -euo pipefail
bash scripts/require_project_updates.sh
```

## 4) gh CLI quick flow

```bash
# create branch
git checkout -b feat/harness-guards

# edit + commit
git add -A
git commit -m "Add harness guards"

# push + PR
git push -u origin feat/harness-guards

gh pr create --fill
```
