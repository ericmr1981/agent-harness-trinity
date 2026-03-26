# Summary style (pretty Summary.md)

Goal: every project gets a **high-signal, navigable, verifiable** `Summary.md`.

## Rules
- **Map-first**: Summary is a *reader-friendly map*, not a diary.
- **One-screen clarity**: top section must answer: what / why / current status.
- **Verifiable**: acceptance criteria must include **how to verify**.
- **Progressive disclosure**: link to deeper docs (Runbook/DoD/Invariants), don’t duplicate everything.

## Recommended sections
- 项目概述（一句话 + 核心价值 + 当前状态）
- 目标与非目标
- 架构图（ASCII is fine）+ 关键模块
- 核心工作流
- 验收标准（DoD/AC）
- 不变量与护栏（guards）
- 测试/验证计划
- 关键路径（repo/runtime/outputs）
- 关键决策记录

## Template
Use: `assets/templates/pretty_summary_template.md`

## Standardization
- If Summary.md is missing: create from template.
- If Summary.md exists but messy: back it up and rewrite using the template (see `scripts/standardize_summary.sh`).
