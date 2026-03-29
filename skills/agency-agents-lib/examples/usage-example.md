# Agency-Agents 使用示例

## 场景 1：前端开发任务

### 任务背景
需要实现一个带虚拟滚动的数据表格组件，支持 1000+ 行数据，要求 FPS > 30。

### Assignment Brief

```markdown
# Assignment: Dashboard 数据表格组件实现

## Role
- Role: `builder`
- Agent Profile: `engineering-frontend-developer`
- Agent File: `skills/agency-agents-lib/agents/engineering/engineering-frontend-developer.md`
- Inject as attachment: yes
- Why: 需要 React 虚拟化和性能优化专业知识

## Goal
- Final goal: `harness/goal.md` (Dashboard 2.0 完整交付)
- Bounded mission: 实现可处理 1000+ 行数据的高性能表格组件

## Contract
- Sprint contract: `harness/contracts/sprint-003-dashboard.md`
- 设计稿：`design/dashboard-table.fig`

## Acceptance (P0)
- [ ] 渲染 1000 行数据，FPS ≥ 30
- [ ] 支持列排序和筛选
- [ ] 键盘导航支持
- [ ] 通过 Lighthouse 可访问性测试 (≥90)

## Evidence
- 性能测试结果：`artifacts/perf-test-1000rows.json`
- Lighthouse 报告：`artifacts/lighthouse-a11y.json`
```

### 实际调用

```bash
# 1. 搜索合适的 Agent
node skills/agency-agents-lib/scripts/search.js --tag react --tag performance

# 2. 创建 subagent (注入 Agent 上下文)
sessions_spawn \
  --runtime subagent \
  --label "dashboard-table-build" \
  --task "实现 Dashboard 数据表格组件" \
  --attachments "skills/agency-agents-lib/agents/engineering/engineering-frontend-developer.md"

# 3. 或者在 main session 中直接引用
# "根据 Frontend Developer Agent 的最佳实践，实现..."
```

---

## 场景 2：多 Agent 协作 Sprint

### 任务背景
完整交付一个新功能：用户数据分析 Dashboard

### Sprint 规划

```markdown
# Sprint Contract: sprint-004-analytics-dashboard

## Goal
在 2 周内交付完整的数据分析 Dashboard

## Rounds

### Round 1: Research (Day 1-2)
- Agent: `product-trend-researcher` (待添加 Marketing 部门)
- Task: 竞品分析 + 用户痛点调研
- Output: `artifacts/competitor-analysis.md`

### Round 2: Architecture (Day 3-4)
- Agent: `engineering-backend-architect`
- Task: 系统架构设计 + 数据库 schema
- Output: 
  - `harness/architecture.md`
  - `harness/schema.sql`

### Round 3: Frontend Build (Day 5-8)
- Agent: `engineering-frontend-developer`
- Task: React 组件实现
- Output:
  - `src/components/Dashboard/`
  - `src/hooks/useAnalytics.js`

### Round 4: Design Review (Day 9)
- Agent: `design-ui-designer`
- Task: UI 一致性审查 + 可访问性检查
- Output: `harness/qa/design-review.md`

### Round 5: Testing (Day 10)
- Agent: `engineering-code-reviewer` (作为 Verifier)
- Task: 代码审查 + 测试覆盖率检查
- Output: `harness/qa/code-review.md`

## Verification
- L1: `npm run build` ✅
- L2: `npm test -- --coverage` ✅ (coverage ≥ 80%)
- L3: 手动测试 Dashboard 加载 (Lighthouse ≥ 90)
```

---

## 场景 3：安全审查任务

### 任务背景
新功能上线前进行安全审计

### Assignment Brief

```markdown
# Assignment: 安全审计

## Role
- Role: `verifier`
- Agent Profile: `engineering-security-engineer`
- Agent File: `skills/agency-agents-lib/agents/engineering/engineering-security-engineer.md`
- Inject as attachment: yes
- Why: 需要专业的威胁建模和安全审查能力

## Scope
- 审查范围：新用户认证模块
- 相关文件：
  - `src/auth/`
  - `src/api/users.ts`
  - `src/middleware/auth.ts`

## Acceptance
- [ ] 威胁模型文档完成
- [ ] OWASP Top 10 检查清单
- [ ] 敏感数据加密审查
- [ ] 认证流程漏洞扫描

## Output
- `harness/qa/security-audit.md`
- `artifacts/threat-model.json`
```

---

## 场景 4：UX 设计审查

### 任务背景
新产品原型的用户体验审查

### Assignment Brief

```markdown
# Assignment: UX 设计审查

## Role
- Role: `verifier`
- Agent Profile: `design-ux-researcher`
- Agent File: `skills/agency-agents-lib/agents/design/design-ux-researcher.md`
- Inject as attachment: yes

## Task
审查新产品原型的用户体验，识别潜在问题

## Deliverables
- 用户旅程地图
- 痛点分析报告
- 改进建议优先级列表

## Output
- `harness/qa/ux-review.md`
- `artifacts/user-journey-map.png`
```

---

## 🎯 最佳实践总结

### ✅ 何时使用专业 Agent

| 场景 | 推荐 Agent | 价值 |
|------|-----------|------|
| React/Vue 组件开发 | Frontend Developer | 性能优化 + 最佳实践 |
| API/数据库设计 | Backend Architect | 可扩展架构 + 安全设计 |
| 上线前审查 | Security Engineer | 威胁建模 + 漏洞识别 |
| UI 一致性检查 | UI Designer | 设计系统合规 |
| 用户体验评估 | UX Researcher | 用户视角 + 痛点识别 |
| 代码质量审查 | Code Reviewer | 建设性反馈 + 质量提升 |

### ⚠️ 何时不需要

| 场景 | 建议 |
|------|------|
| 简单 bug 修复 | 通用 Builder 即可 |
| 文档更新 | 通用 Builder + Technical Writer 参考 |
| 测试脚本编写 | 通用 Builder + 现有测试规范 |
| 日常运维任务 | DevOps Automator 仅在复杂场景需要 |

### 💡 Token 优化技巧

1. **按需注入** — 只在 subagent 需要时注入，main session 保持轻量
2. **只注入相关文件** — 例如只注入 Frontend Developer，不注入整个 Engineering 部门
3. **使用索引搜索** — 先用 `search.js` 找到最匹配的 Agent
4. **复用已有上下文** — 如果任务与之前类似，引用之前的 artifact 而非重新注入

---

## 📝 快速参考

```bash
# 搜索 Agent
node skills/agency-agents-lib/scripts/search.js --tag <tag>
node skills/agency-agents-lib/scripts/search.js --category engineering
node skills/agency-agents-lib/scripts/search.js --list

# 查看 Agent 详情
cat skills/agency-agents-lib/agents/engineering/engineering-frontend-developer.md

# 查看完整索引
cat skills/agency-agents-lib/index.json | jq '.agents[] | select(.category=="engineering")'
```
