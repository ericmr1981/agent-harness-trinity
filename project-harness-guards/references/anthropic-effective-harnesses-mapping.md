# Anthropic《Effective harnesses for long-running agents》→ 三技能家族落地对照卡

> 目标：让“长任务跨多个 context window”变成**可续跑、可验收、可回滚**的工程流程。

## Anthropic 的核心编排（两段式）

### 1) Initializer agent（首轮一次性）
产物（必须留下可交接 artifacts）：
- `init.sh`：一键启动/环境自检（最好带最小 smoke / e2e）
- `claude-progress.txt`（或同类进度日志）：交接班记录
- feature list（结构化 JSON）：大量 end-to-end 功能条目，初始全 `passes:false`
- 初始 git commit：把脚手架与约束固定成“可回滚状态机”

### 2) Coding agent（每轮重复）
行为（每轮必须“干净收尾”）：
- 开局：读 `git log` + progress log + feature list；跑 `init.sh` 做 smoke
- 只做**一个**最高优先级 failing feature（增量推进）
- 只在验证通过后把 `passes:false → true`
- 结束：写进度日志 + git commit（必要时可 revert）

## 他们总结的 4 个常见失败模式 → 对策

| 失败模式 | Initializer 侧对策 | Coding 侧对策 |
|---|---|---|
| 过早宣布“整个项目完成” | 建立 feature list（结构化 JSON，覆盖完整端到端） | 每轮先读 feature list，只挑 1 个未完成项做 |
| 留下 bug / 半拉子 / 无交接 | 建好 git repo + progress log | 开局读 log + `git log` 并跑 smoke；收尾 commit + progress 更新 |
| 功能没测就标 done | feature list + 强约束“只能改 passes” | 强制自测（最好端到端）；只在证据充足后标 passing |
| 每轮都花时间搞清怎么跑项目 | 写 `init.sh` | 开局先读/跑 `init.sh`（避免环境漂移） |

## 映射到“三技能家族”

### project-harness-guards（= Initializer agent）
落地要点：
- 在 repo 内生成/补齐：`CLAUDE.md` / `AGENTS.md` / `features.json` / `CHANGELOG.md(or claude-progress.txt)` / `init.sh` / `tests/` / `harness.json`
- 安装 guards：`scripts/run_drift_check.sh` + `scripts/run_change_guard.sh`
- 目标：把 repo 变成“可续跑状态机”（有记录、有 oracle、有恢复路径）

### dev-project-harness-loop（= Coding agent + 强验收护栏）
落地要点：
- 每回合：baseline → 选 1 个 failing feature → 实现 → oracle ladder(L0/L1/L2) → commit+log → flip passes
- 里程碑前：必须过 `run_change_guard.sh` + 再跑一次 L2（反“假完结”）

### dev-project-autoloop（= Coding loop 的轻量版）
落地要点：
- 同样强调“小步、可验证、可回滚、commit+log”，但不强制完整 harness/guards

## 我们建议的“硬规则”（直接抄进项目约束）
- `features.json`：**只允许修改 `passes` 字段**（不得删改 feature 描述/步骤）
- 开局必跑：`bash init.sh` + 最小 smoke（先修“坏状态”，再加新功能）
- 结束必做：git commit + progress log 交接（写明：做了什么 / 验收命令 / 下一步）
