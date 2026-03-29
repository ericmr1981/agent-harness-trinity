# Agency-Agents Library

**专业 AI 角色技能库** — 为 `agent-harness-trinity` 提供 200+ 领域专家角色

---

## 🚀 快速开始

### 1. 搜索需要的 Agent

```bash
# 按标签搜索
node skills/agency-agents-lib/scripts/search.js --tag react --tag ui

# 按部门浏览
node skills/agency-agents-lib/scripts/search.js --category engineering
node skills/agency-agents-lib/scripts/search.js --category design

# 列出所有
node skills/agency-agents-lib/scripts/search.js --list
```

### 2. 在 Assignment 中使用

```markdown
## Role
- Role: `builder`
- Agent Profile: `engineering-frontend-developer`
- Agent File: `skills/agency-agents-lib/agents/engineering/engineering-frontend-developer.md`
- Inject as attachment: yes
```

### 3. 注入到 Subagent

```bash
sessions_spawn \
  --runtime subagent \
  --task "实现 React 数据表格组件" \
  --attachments "skills/agency-agents-lib/agents/engineering/engineering-frontend-developer.md"
```

---

## 📦 当前可用

| 部门 | Agent 数量 | 状态 |
|------|-----------|------|
| **Engineering** | **26** | ✅ 已加载 |
| **Design** | **8** | ✅ 已加载 |
| Marketing | TBD | ⏳ 待添加 |
| Sales | TBD | ⏳ 待添加 |
| Product | TBD | ⏳ 待添加 |
| Testing | TBD | ⏳ 待添加 |

---

## 📖 文档

| 文档 | 说明 |
|------|------|
| [`SKILL.md`](./SKILL.md) | 完整使用规范 + 最佳实践 |
| [`index.json`](./index.json) | 可搜索的 Agent 索引 |
| [`examples/usage-example.md`](./examples/usage-example.md) | 4 个实际使用场景示例 |

---

## 🎯 热门 Agent

### Engineering
- 🖥️ **Frontend Developer** — React/Vue/Angular, UI 性能优化
- 🏗️ **Backend Architect** — 系统架构，数据库，微服务
- 🔒 **Security Engineer** — 威胁建模，安全审计
- 👁️ **Code Reviewer** — 代码审查，质量提升
- 🗄️ **Database Optimizer** — 查询优化，索引策略

### Design
- 🎯 **UI Designer** — 视觉设计，组件库，设计系统
- 🔍 **UX Researcher** — 用户测试，行为分析
- 🎭 **Brand Guardian** — 品牌识别，一致性

---

## 🔧 维护

### 添加新部门
```bash
# 1. 复制文件
cp -r ../../../_tmp/agency-agents-review/marketing/*.md \
  agents/marketing/

# 2. 重建索引
node scripts/build_index.js

# 3. 更新 README.md 和 SKILL.md 表格
```

### 同步上游
```bash
cd ../../../_tmp/agency-agents-review
git pull origin main

# 重新复制对应部门
# 重新运行 build_index.js
```

---

## 📄 License

MIT (继承自 [agency-agents](https://github.com/msitarzewski/agency-agents))
