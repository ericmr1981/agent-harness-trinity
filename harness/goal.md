# Goal Contract

## Final goal
把 `agent-harness-trinity` 打造成**完全 Trinity-compliant** 的技能套件主仓：
1. 所有核心文件齐全（CLAUDE.md / AGENTS.md / features.json / init.sh / harness.json / CHANGELOG.md / docs/ / tests/）
2. `bash scripts/run_trinity_guard.sh` 全通过
3. `bash scripts/scaffold_harness.sh` 可在任意空目录生成合规 harness
4. OpenClaw Jarvis 加载本套件无报错

## Deliverable shape
- **用户可见成果**：OpenClaw agent 执行项目时能正确调用 skill、守卫脚本、脚手架生成器
- **技术成果**：每个 skill 的 SKILL.md 完整、CLI 脚本通过语法检查、guard 脚本可独立运行
- **必需证据**：`run_trinity_guard.sh` 输出 [OK]

## Non-goals
- 不实现新的 skill 功能
- 不做 Render/VPS 部署

## Constraints
- 不破坏已有的 skill 逻辑
- 脚手架文件只填充必要内容，不过度工程化

## Approval boundaries
- 删除已有 skill 目录 → 需确认
- 修改 harness.js 核心逻辑 → 需确认
- 发布新版 skill 到 clawhub.com → 需确认

## Reporting mode
- milestone-only

## Stop conditions
- **Done when**: `bash scripts/run_trinity_guard.sh` 输出 `[OK]` 且所有 7 个必需文件存在
- **Blocked when**: guard 失败且无法在当前 session 修复
- **Escalate when**: 需要删除/重构已有 skill 目录
