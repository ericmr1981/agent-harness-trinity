# CLAUDE.md - Agent Harness Trinity

## Mission
**Trinity 技能套件主仓** — 为 OpenClaw long-running agent 项目提供：
1. 完整执行循环（harness-loop / autoloop）
2. 脚手架生成 + 守卫验证
3. Subagent 调度规范
4. 专业角色库

## What this repo is
- 技能源码（`dev-project-harness-loop/`、`project-harness-guards/` 等）
- 运行时脚本（`scripts/`）
- 供 OpenClaw agent（Jarvis）在执行项目时调用

## What this repo is NOT
- 非业务项目（不是要部署的 app）
- 非可独立运行的前端/后端服务

## Acceptance target
- [x] 所有技能脚本通过 `node --check`
- [x] `bash scripts/run_trinity_guard.sh` 全通过
- [x] `bash scripts/scaffold_harness.sh` 可在任意空目录生成完整 harness
- [x] OpenClaw Jarvis 可通过 skill 调用本套件完成项目执行

## Non-goals
- 不做业务功能实现（不属于任何单一业务项目）
- 不维护运行时依赖（OpenClaw 侧负责版本）

## Constraints
- 所有 skill 脚本写完必须 `node --check`
- Guard 脚本失败必须显式记录，不静默忽略
- 不在 `scripts/` 外硬编码路径
