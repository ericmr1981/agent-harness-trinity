# Record-root governance pack (optional)

This folder is an **optional add-on** for `project-harness-guards` when you keep a separate
"project record root" outside the repo (commonly an Obsidian project directory) containing
files like `Goal.md`, `Map.md`, `ProjectTasks.md`, `Harness_DoD.md`, `Summary.md`.

It provides:
- scaffolding + upgrade scripts for the record root
- drift checks for key paths / commands / ports
- a log guard that flags "files changed but ProjectTasks.md wasn't updated" (mtime heuristic)
- optional Git gate to require ProjectTasks updates on commits
- a lightweight external truth layer that mirrors repo-first Trinity concepts

Recommended external record-root artifacts:
- `Goal.md` — final goal, non-goals, approval boundaries
- `Map.md` — key paths, repo links, verification pointers
- `ProjectTasks.md` — task list + change log + current execution truth
- `Harness_DoD.md` — acceptance / guard expectations
- `Handoff.md` — short resume / transfer note
- `Summary.md` — human-facing project summary

Design stance:
- **Messages notify; files decide.**
- If both repo and record-root exist, repo-local evidence and record-root task state must agree.
- Repo-first Trinity users can ignore this pack.
