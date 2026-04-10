# ACTIVE.md — Current WIP

> Repo-local source of truth for the next bounded bet.

## Current Project
- **Name**: agent-harness-trinity
- **Repo**: /Users/ericmr/Documents/GitHub/agent-harness-trinity
- **Objective**: Keep Trinity trustworthy in real use: finish the Minimal Ralph Upgrade and harden the repo→runtime sync path so update tooling does not lie or corrupt runtime files.
- **Status**: running
- **Started**: 2026-04-10 08:36 GMT+8

## Current Bet
- **Bet**: Repair `scripts/sync_skills.sh` so `--sync` really adopts untagged installs, `--force` actually rewrites already-synced files, and version tracking no longer pollutes JS/JSON syntax.
- **Why this bet**: The old sync path falsely reported success on untagged global installs, and the inline `SYNCTAG` strategy could break ESM / JSON runtime files.

## Oracle
- `bash -n scripts/sync_skills.sh`
- `bash /tmp/trinity_sync_sidecar_validate.sh`
- `bash /tmp/trinity_sync_force_validate.sh`
- `node --check /usr/local/lib/node_modules/openclaw/skills/dev-project-harness-loop/scripts/harness.js`
- `node --check /usr/local/lib/node_modules/openclaw/skills/dev-project-harness-loop/scripts/context-assembler/context-assembler.js`
- 全局关键文件无内联 `SYNCTAG`，且对应 `.synctag` sidecar 存在

## Result
- **Outcome**: goal_closed
- **Current Blocker**: None
- **Stop Allowed**: yes
- **Next Bet**: 可选——更新 README / HARNESS-INSTALL-GUIDE，把 sync 版本机制说明从“文件头注释”改为 sidecar `.synctag`。

## Evidence
- `untagged` 分支现在在 plain `--sync` 下就会执行真实下载与收编，不再“口头同步”
- `--force` 现在覆盖 `✅ up-to-date` 分支，真正执行重写
- `SYNCTAG` 从文件内联注释迁移为 `*.synctag` sidecar，避免污染 `.js` / `.json`
- 临时验证通过：untagged 文件会生成 sidecar；up-to-date + stale inline tag 会被 `--sync --force` 清理
- 全局 skills 已用新脚本刷新，`node --check` 恢复通过且无内联 `SYNCTAG`

## Files Touched This Round
- `scripts/sync_skills.sh`
- `features.json`
- `CHANGELOG.md`
- `ACTIVE.md`

---
*Last updated: 2026-04-10 10:16 GMT+8*
