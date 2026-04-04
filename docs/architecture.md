# Architecture Rules

## Skill 目录结构
每个 skill 是独立模块，包含：
- `SKILL.md` — 技能说明 + 使用 SOP
- `scripts/` — 可执行脚本
- `references/` — 参考文档

## 脚本加载顺序
```
OpenClaw agent → SKILL.md → scripts/*.sh / scripts/*.js
```

## 路径约定
- 所有脚本使用相对路径或 `$(dirname $0)` 自定位
- 不在 scripts/ 外硬编码绝对路径
- `scripts/` 内脚本可通过 `run_*.sh` 调用同一 skill 下的其他脚本

## Guard 脚本
- `scripts/run_drift_check.sh` — 必需文件检查（7 个）
- `scripts/run_change_guard.sh` — drift check + testCommand
- Guard 脚本位于 `project-harness-guards/scripts/`，由 scaffold_harness.sh 复制到目标项目

## Skill 依赖关系
- `dev-project-harness-loop` 依赖 `project-harness-guards`
- `harness-dispatch` 依赖 `dev-project-harness-loop`
- `agency-agents-lib` 独立，无依赖
- `subagent-coding-lite` 独立，无依赖
