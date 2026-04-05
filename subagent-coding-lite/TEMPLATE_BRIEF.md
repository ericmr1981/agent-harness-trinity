# Subagent Brief（合并模板 — assignment + handoff 一体）

> **用途**：作为 subagent 的唯一入ロ文档，包含任务说明、验收标准、返回格式。  
> **Token 优化**：相较于分开的 TEMPLATE_ASSIGNMENT.md + TEMPLATE_HANDOFF.md，本模板将重复字段合并，裁剪至 ~600-800 tokens。  
> **版本**：v2 | 2026-03-30

---

## §1 角色与任务

- **Role**: `planner` | `builder` | `verifier` | `researcher`
- **Agent ID**（如指定）: `engineering-frontend-developer` | `engineering-backend-architect` | `...`
- **Agent File**: `skills/agency-agents-lib/agents/<category>/<agent>.md`（如需注入）
- **Mission**: 简洁描述这个 sprint 要完成什么（1-3 句话）
- **Harness Profile**: `Solo` | `PG` | `PGE-final` | `PGE-sprint`
- **Complexity Score**: X/10（见本文件末尾评分卡）

---

## §2 目标与合同指针

- Goal: `harness/goal.md`
- Spec（如有）: `harness/spec.md`
- Sprint Contract: `harness/contracts/<sprint-id>.md`
- Prior QA / Handoff（如有）: `harness/qa/<sprint-id>.md` | `harness/handoffs/<id>.md`

> 如果合同缺失或不可测试，**立即停止并请求合同更新**，不要猜测。

---

## §3 上下文

### 重要协议：只要“最小可完成上下文”，禁止索取全文
- 默认上下文可能是 **抽取片段（snippets）**，不是完整文档；这是刻意的 token 安全策略。
- **不得**要求“把整个文档/整个仓库都贴出来”。
- 如果你确实需要更多信息，必须用以下格式提出**精确请求**（最多 3 项）：
  1) `file`: `<path>`
  2) `section/lines`: `<章节名或行号范围>`
  3) `why`: 这一信息将如何影响实现/验收（1 句话）

### 相关文件 / 目录
- `src/app.ts`
- `src/engine/tetris.ts`
- ...

### 已知问题 / 错误日志
- 上一轮测试输出: `artifacts/test-*.log`
- 当前症状: ...

---

## §4 范围边界

### ✅ 允许范围（In scope）
- `src/engine/tetris.ts` — 游戏核心逻辑修改
- `src/app.ts` — 路由与 store 更新

### ❌ 禁止范围（Out of scope）
- 不修改 `src/ui/` 目录
- 不添加新的 npm 依赖
- 不改变 API 接口契约

### 🚫 必须禁止
- **不得**运行 `git commit`、`git push`、创建 PR 或变更远程状态
- **不得**修改网关/运行时配置
- **不得**超越合同范围扩展任务
- **不得**未经授权修改 harness 文档

---

## §5 能力声明

| 能力 | 允许？ |
|------|--------|
| 编辑产品代码 | yes / no |
| 外部搜索/研究 | yes / no |
| 运行验证命令 | yes（见 §6） |
| 编辑 harness 文档 | no |
| 运行 `npm install` | yes / no |

---

## §6 验收标准

### P0（默认）
- L0（构建）: `npm run build` ✅
- L1（测试）: `npm test` ✅
- 手动检查：
  - 场景 A（正常路径）:
  - 场景 B（边界/错误路径）:

### P1（高风险变更 — 需额外一项 e2e）
- 上述全部 +
- E2E: `npm run e2e` 或手动验收描述

### 快速验证命令（main agent 用）
```
cd /path/to/repo && npm run build && npm test
```

---

## §7 工件规则

- **长输出必须**写入 `artifacts/`（禁止留在主会话）
  - 示例: `artifacts/build-20260330.log`
  - 示例: `artifacts/creenshot-*.png`
- 主会话回复**只包含摘要** + 工件路径引用

---

## §8 返回格式（Handoff Section — 末尾必须包含）

Subagent **必须**在任务结束时在主会话中返回以下结构（写在工件路径之后）：

```
## 📦 Handoff Packet

**Status**: ✅ done | ⚠️ partial | 🔴 blocked
**Sprint**: <sprint-id>

### ✅ 已完成
- 文件变更清单 + 变更原因（3-10 条bullet）

### ❌ 未完成
- 列出所有合同中未完成项

### 🔍 验证证据
- 命令 + 简短结果 + artifacts 路径
- 主 agent 快速验证: `cd /path && npm test`

### 📊 评估
- 判决: PASS | FAIL | PARTIAL
- 风险 / 边界情况:
- 置信度: H/M/L

### 💡 建议
1. 下一步（最多 3 条）
2. 如需 Boss 决策 → 说明决策项 + 选项 + 推荐
```

---

## 附录：Complexity Score Card（复杂度评分卡）

> **用途**：给每个任务打客观复杂度分，决定注入量、profile 和 agent 级别。

| 指标 | 0 分 | 1 分 | 2 分 | 得分 |
|------|------|------|------|------|
| **涉及文件数** | 1 | 2-5 | >5 | __ |
| **代码行改动量** | <20 | 20-200 | >200 | __ |
| **测试覆盖** | 有单元测试 | 部分覆盖 | 无测试 | __ |
| **多角色依赖** | 无 | 涉及 1 种角色 | 涉及 2+ 角色 | __ |
| **用户可见变更** | 无 | 小 UI 改动 | 核心功能变化 | __ |

**总分 = Σ 各指标得分**（满分 10 分）

| 总分 | → Profile 推荐 | → Mode 推荐 | → Agent 推荐 |
|------|--------------|------------|------------|
| 0-2 | Solo | `--mode minimal` | 无需 subagent，主 session 自治 |
| 3-4 | Solo / PG | `--mode keyword` | `engineering-senior-developer` |
| 5-6 | PG / PGE-final | `--mode llm` | 按领域选择 |
| 7-10 | PGE-sprint | `--mode llm --full` | 多角色，依赖链 |

> **评分人**：主 agent 在调用 harness.js 之前填写此卡，作为决策依据。  
> **用途**：harness.js 会读取环境变量 `COMPLEXITY_SCORE`，跳过重复分析（已由主 agent 预先计算）。

---

*模板版本：v2 | 更新日期：2026-03-30 | 替换：TEMPLATE_ASSIGNMENT.md + TEMPLATE_HANDOFF.md（两文件已合并，废弃）*
