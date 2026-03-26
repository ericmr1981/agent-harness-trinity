# Record-root governance pack (optional)

This folder is an **optional add-on** for `project-harness-guards` when you keep a separate
"project record root" outside the repo (commonly an Obsidian project directory) containing
files like `Map.md`, `ProjectTasks.md`, `Harness_DoD.md`, `Summary.md`.

It provides:
- scaffolding + upgrade scripts for the record root
- drift checks for key paths/commands/ports
- a log guard that flags "files changed but ProjectTasks.md wasn't updated" (mtime heuristic)
- optional Git gate to require ProjectTasks updates on commits

Repo-first Trinity users can ignore this pack.
