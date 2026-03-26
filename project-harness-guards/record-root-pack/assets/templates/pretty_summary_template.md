# <ProjectName> — Summary

> 目标：像 `/Users/ericmr/Documents/GitHub/Obsidian/项目/oa-cli 分析/Summary.md` 一样，做到：
> - 一屏看懂：目标/现状/机制
> - 可导航：目录结构清晰、入口明确
> - 可验收：关键口径/不变量/验证方式写明
> - 可演进：把“决策与约束”固化成记录系统

---

## 📋 项目概述

**一句话定义**：<用 1 句话描述项目是什么>

### 核心价值
- <价值 1>
- <价值 2>
- <价值 3>

### 当前状态
- 阶段：<PLANNING/BUILDING/RUNNING/MAINTENANCE>
- 最近更新：<YYYY-MM-DD>
- 负责人：<Owner>

---

## 🎯 目标与非目标

### 目标（Goals）
- G1：<...>
- G2：<...>

### 非目标（Non-goals）
- NG1：<...>

---

## 🏗️ 系统结构（架构图 + 关键模块）

> 原则：给“地图”，不是说明书。

```text
<用 ASCII 画一个 10~20 行内的架构图>
```

### 关键模块
- 模块 A：<职责/输入输出/边界>
- 模块 B：<职责/输入输出/边界>

---

## 🔁 核心工作流（从触发到产出）

### Workflow 1：<名称>
1) <步骤>
2) <步骤>
3) <步骤>

### Workflow 2：<名称>
...

---

## ✅ 验收标准（Definition of Done）

> 写成“可验证断言”，不要写成口号。

- [ ] AC1：<断言>（验证：<命令/脚本/页面/日志>）
- [ ] AC2：<断言>（验证：...）

---

## 🔒 不变量（Invariants）与护栏（Guards）

### 不变量（引用 `Invariants.md`）
- I1：<...>
- I2：<...>

### 护栏（推荐）
- 变更门禁：`bash scripts/run_change_guard.sh "<project-root>"`
- 最低要求：`bash scripts/run_drift_check.sh "<project-root>"`

---

## 🧪 测试/验证计划（最小回归）

- Smoke：<...>
- Regression：<...>
- 风险点：<...>

---

## 📁 项目目录与关键路径（链接/绝对路径）

- Project record root（Obsidian）：`/Users/ericmr/Documents/GitHub/Obsidian/项目/<ProjectName>`
- Code repo：<path or URL>
- Runtime/Outputs：<path>

---

## 📝 关键决策记录（Decision Log）

| Date | Decision | Reason | Impact |
|------|----------|--------|--------|
| <date> | <...> | <...> | <...> |
