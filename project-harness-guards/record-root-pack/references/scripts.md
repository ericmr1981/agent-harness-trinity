# Scripts (project-harness-guards)

> All scripts accept a **project record root** path (Obsidian project directory).

## Run guards

### Change guard (recommended)
Runs **drift_check + log_guard**.

```bash
bash scripts/run_change_guard.sh "/path/to/project-record-root"
```

Exit codes:
- `0`: OK
- `2`: RISK (must fix or record explicit risk acceptance)

### Drift check only (minimum)

```bash
bash scripts/run_drift_check.sh "/path/to/project-record-root"
bash scripts/run_drift_check.sh "/path/to/project-record-root" --json
```

## Scaffold / standardize project docs

### Standardize Summary.md (pretty summary)

```bash
bash scripts/standardize_summary.sh "/path/to/project-record-root"
```

- Makes a backup of existing `Summary.md` (unless you pass `--force`)
- Rewrites `Summary.md` using `assets/templates/pretty_summary_template.md`

### New project scaffold

```bash
bash scripts/scaffold_project_harness.sh "/path/to/project-record-root"
```

Creates (if missing):
- `Map.md`, `ProjectTasks.md`, `Summary.md`, `Readme.md`
- recommended harness set: `Invariants.md`, `Harness_DoD.md`, `Runbook.md`, `Doc_Gardening.md`
- `scripts/` inside the project directory with guards

### Standardize an existing project (non-destructive upgrade)

```bash
bash scripts/upgrade_existing_project.sh "/path/to/project-record-root"
```

Behavior:
- Creates a backup: `.harness-backup-<timestamp>/`
- Creates missing docs (does not delete existing files)
- Installs/refreshes guard scripts under `scripts/`
- Runs `run_change_guard.sh` at the end and fails if risk is detected

## Git gate (optional)

If inside a git repo:

```bash
bash scripts/require_project_updates.sh
```

It fails if staged changes include code/config/scripts but `ProjectTasks.md` is not staged.
