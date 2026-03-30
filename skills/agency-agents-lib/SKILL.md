# Agency-Agents Library

**200+ 专业 AI 角色技能库** — 按需注入到 harness 流程中的 Builder/Verifier/Researcher 角色

> 来源：https://github.com/ericmr1981/agency-agents (fork of msitarzewski/agency-agents)

---

## 📦 当前可用

| 部门 | Agent 数量 | 状态 |
|------|-----------|------|
| Engineering | 26 | ✅ 已加载 |
| Design | 8 | ✅ 已加载 |
| Marketing | TBD | ⏳ 待添加 |
| Sales | TBD | ⏳ 待添加 |
| Product | TBD | ⏳ 待添加 |
| Testing | TBD | ⏳ 待添加 |

---

## 🚀 快速使用

### 方式 1：在 Assignment 中引用

```markdown
## Role
- Role: `builder`
- Agent Profile: `engineering-frontend-developer`
- Agent File: `skills/agency-agents-lib/agents/engineering/engineering-frontend-developer.md`

## Goal
- 使用 Frontend Developer Agent 的专业能力实现 React 数据表格组件
```

### 方式 2：Subagent 注入

```bash
# 通过 sessions_spawn 注入 Agent 上下文
sessions_spawn \
  --runtime subagent \
  --task "实现带虚拟滚动的数据表格" \
  --label "frontend-build" \
  --attachments "skills/agency-agents-lib/agents/engineering/engineering-frontend-developer.md"
```

### 方式 3：搜索 Agent

```bash
# 按标签搜索
node skills/agency-agents-lib/scripts/search.js --tag react --tag ui

# 列出所有 Engineering Agent
node skills/agency-agents-lib/scripts/search.js --category engineering
```

---

## 📖 Agent 索引

完整索引见：[`index.json`](./index.json)

### Engineering 部门 (26 个)

| Agent | 专长 | 标签 |
|-------|------|------|
| 🎨 Frontend Developer | React/Vue/Angular, UI, 性能优化 | react, ui, frontend |
| 🏗️ Backend Architect | 系统架构，数据库，微服务 | api, database, cloud |
| 📱 Mobile App Builder | iOS/Android, React Native, Flutter | mobile, ios, android |
| 🤖 AI Engineer | ML 模型，AI 集成，数据管道 | ml, ai, data |
| 🚀 DevOps Automator | CI/CD, 基础设施自动化 | devops, ci/cd, aws |
| ⚡ Rapid Prototyper | 快速 POC, MVP | mvp, prototype |
| 💎 Senior Developer | Laravel/Livewire, 高级模式 | laravel, php |
| 🔒 Security Engineer | 安全架构，威胁建模 | security, threat |
| 📚 Technical Writer | 技术文档，API 参考 | docs, api |
| 👁️ Code Reviewer | 代码审查，质量保证 | review, quality |
| 🗄️ Database Optimizer | 查询优化，索引策略 | sql, database |
| 🌿 Git Workflow Master | 分支策略，Git 流程 | git, workflow |
| ... | ... | ... |

### Design 部门 (8 个)

| Agent | 专长 | 标签 |
|-------|------|------|
| 🎯 UI Designer | 视觉设计，组件库，设计系统 | ui, design, components |
| 🔍 UX Researcher | 用户测试，行为分析 | ux, research, testing |
| 🏛️ UX Architect | 技术架构，CSS 系统 | ux, css, architecture |
| 🎭 Brand Guardian | 品牌识别，一致性 | brand, identity |
| 📖 Visual Storyteller | 视觉叙事，多媒体内容 | visual, storytelling |
| ✨ Whimsy Injector | 个性注入，微交互 | delight, micro-interactions |
| 📷 Image Prompt Engineer | AI 图像生成提示词 | ai, image, prompt |
| 🌈 Inclusive Visuals | 包容性视觉，无偏见 | inclusive, accessibility |

---

## 🔀 Agent Decision Tree（v4 新增）

> 用于替代纯关键词匹配，提高 agent 选择的语义准确性。

### 决策矩阵：action-verb × target-type

| | frontend | backend | database | devops | security | ai | mobile |
|---|---|---|---|---|---|---|---|
| **implement** | frontend-developer | backend-architect | database-optimizer | devops-automator | senior-developer | ai-engineer | mobile-app-builder |
| **fix** | frontend-developer | backend-architect | database-optimizer | — | security-engineer | — | — |
| **refactor** | senior-developer | senior-developer | senior-developer | — | — | — | — |
| **design** | software-architect | software-architect | software-architect | software-architect | — | — | — |
| **test** | test-engineer | test-engineer | test-engineer | — | — | — | — |
| **deploy** | — | — | — | devops-automator | — | — | — |
| **secure** | — | — | — | — | security-engineer | — | — |
| **document** | technical-writer | technical-writer | technical-writer | — | — | — | — |
| **analyze** | ux-researcher | senior-developer | — | — | — | ai-engineer | — |
| **build_ui** | ui-designer | — | — | — | — | — | — |

### 选择规则

1. **先匹配 action verb**（implement / fix / refactor / design / test / deploy / secure / document / analyze / build_ui）
2. **再匹配 target type**（frontend / backend / database / devops / security / ai / mobile）
3. **matrix 有精确匹配则用精确匹配**；否则 fallback 到 `action|*`
4. **复杂度 ≥ 5 时，LLM 建议优先于 decision tree**
5. **无任何匹配时**：默认 `engineering-senior-developer`

### 使用方式

在 harness.js v4 中自动调用（llm / llm-full 模式）：
```javascript
const agent = agencyDecisionTree(taskDescription, llmResult, complexity);
```

主 agent 也可独立使用此决策树，无需运行 harness.js：
```javascript
// 例：用户说 "修复前端的登录 bug"
const agent = agencyDecisionTree("修复前端的登录 bug", null, 3);
// → engineering-frontend-developer
```

---

## 🔧 Helper 脚本

### build_index.js
生成/更新索引文件
```bash
node skills/agency-agents-lib/scripts/build_index.js
```

### search.js (待创建)
搜索 Agent
```bash
node skills/agency-agents-lib/scripts/search.js --tag frontend
```

### inject_agent.sh (待创建)
注入 Agent 到 subagent 会话
```bash
./skills/agency-agents-lib/scripts/inject_agent.sh --agent frontend-developer --role builder
```

---

## 📋 与 Harness 集成

### 修改 Assignment Template

在 `subagent-coding-lite/TEMPLATE_ASSIGNMENT.md` 中增加：

```markdown
## Agent Profile (可选)
- Agent ID: `engineering-frontend-developer`
- Agent File: `agency-agents-lib/agents/engineering/engineering-frontend-developer.md`
- Inject as attachment: yes | no
```

### 在 Harness Loop 中使用

```markdown
## Sprint Contract: Dashboard 2.0

### Round 1: Research
- Agent: `product-trend-researcher` (待添加)
- Output: 竞品分析报告

### Round 2: Architecture
- Agent: `engineering-backend-architect`
- Output: 系统架构图 + 数据库设计

### Round 3: Implementation
- Agent: `engineering-frontend-developer`
- Output: React 组件 + 单元测试

### Round 4: Verification
- Agent: `engineering-code-reviewer` (待添加)
- Output: QA 报告 + 改进建议
```

---

## 🎯 最佳实践

### ✅ 推荐用法
1. **按需注入** — 只在需要专业能力时注入对应 Agent
2. **保持上下文精简** — 只注入相关的 Agent 文件，避免 token 浪费
3. **组合使用** — 一个 Sprint 中可组合多个专业 Agent
4. **更新索引** — 添加新部门后运行 `build_index.js`

### ⚠️ 注意事项
1. **Token 成本** — 完整注入一个 Agent 约 200-500 tokens
2. **角色冲突** — 避免同时注入多个相同角色的 Agent
3. **上下文长度** — 长任务分多轮，避免单次注入过多 Agent

---

## 🔄 更新流程

### 添加新部门
```bash
# 1. 复制部门文件
cp -r ../_tmp/agency-agents-review/marketing/*.md \
  skills/agency-agents-lib/agents/marketing/

# 2. 重建索引
node skills/agency-agents-lib/scripts/build_index.js

# 3. 更新 SKILL.md 表格
# (手动编辑本文件)
```

### 同步上游更新
```bash
cd ../_tmp/agency-agents-review
git pull origin main

# 重新复制
cp -r engineering/*.md ../../agent-harness-trinity/skills/agency-agents-lib/agents/engineering/
node skills/agency-agents-lib/scripts/build_index.js
```

---

## 📝 版本历史

- **v0.1.0** (2026-03-29) — Initial: Engineering (26) + Design (8)

---

## 📄 License

MIT (继承自 agency-agents)
