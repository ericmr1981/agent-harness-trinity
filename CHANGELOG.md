# Progress Log

## 2026-04-09 — 修正 codemap 统计漂移并同步仓库记录
**refs:** `88d2529` (HEAD), `10f9847`

**本轮完成：**
- 修正 `dev-project-harness-loop/scripts/codemap.js` 的 `trackedSrcCount` 计算逻辑：现在只统计 **tracked source files**（`ts/tsx/js/jsx/go/py`），不再把整个仓库的 tracked 文件总数误记进去
- 实测 codemap cache 行为：
  - clean worktree 第二次运行会 **skip**
  - dirty tracked source file 会 **强制重建**
- 将验证日志落盘到 `harness/artifacts/verification/`
- 同步 `.gitignore`，屏蔽生成型 artifacts 噪音：`codemap.md`、`codemap.meta.json`、`verification/`
- 回填并对齐项目记录：`ACTIVE.md`、`features.json`

**验证：**
- `node dev-project-harness-loop/scripts/codemap.js . --output harness/artifacts/codemap.md`
- temp git worktree clean/dirty 回归：见 `harness/artifacts/verification/codemap-clean-dirty.log`
- `bash scripts/run_drift_check.sh`
- `bash scripts/run_trinity_guard.sh`
- `bash init.sh`
- `find . -name '*.js' -not -path './node_modules/*' -exec node --check {} \;`
- `grep -c 'TODO' CLAUDE.md AGENTS.md harness/goal.md | grep -q '0'`
- `bash tests/smoke.sh`
- temp scaffold smoke：见 `harness/artifacts/verification/scaffold-smoke.log`

**结论：**
- Trinity 主仓当前 guard/ smoke/ scaffold 主链路均已通过
- `trackedSrcCount` 遗留问题已复现并修复，cache 判定恢复可信
- 当前剩余工作主要是是否要把这批本地修正直接 commit / push

---

## 2026-04-04 — 补齐 Trinity 合规骨架
**commit:** `0a86e34` (feat: close v5 preview continue-gate result flow)

**本轮完成：**
- 生成 7 个必需文件：CLAUDE.md、AGENTS.md、CHANGELOG.md、features.json、init.sh、harness.json、docs/architecture.md
- 生成 tests/smoke.sh
- 安装 guard 脚本：scripts/run_drift_check.sh、scripts/run_change_guard.sh
- 填充 CLAUDE.md / harness/goal.md / features.json 实际内容
- init.sh 可执行，Node 语法检查通过

**剩余 gap（已消除）：**
- ✅ CLAUDE.md / AGENTS.md / features.json / init.sh / harness.json / docs/ — 全部就位
- ✅ scripts/run_trinity_guard.sh — 已安装
- ✅ 初始 CHANGELOG.md 条目已写入

**验证：**
- `bash scripts/run_drift_check.sh`
- `bash init.sh`
- `find . -name '*.js' -not -path './node_modules/*' -exec node --check {} \;`

---
