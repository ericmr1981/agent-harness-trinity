# Quality / tech debt

Track known issues, flakiness, and quality ratings.

---

## Subagent Context Quality (Token Safety)

### Problem
When reference docs become large, naïvely attaching full documents to subagents causes:
- context/window overflow (hard failure)
- attention dilution (soft failure)
- repeated duplication of the same large text across multiple sprints

### Policy (must-follow)
**Never attach “whole docs” to subagents by default.**

Subagent context must be assembled in layers:

1) **Layer A — Contract (always)**
- Goal / non-goals
- Acceptance criteria
- Constraints & boundaries

2) **Layer B — Extracted relevant snippets (preferred)**
- Provide only small windows around keyword hits / relevant sections
- Include file path + line ranges
- Hard-cap total injected size

3) **Layer C — Index / retrieval entrypoints (always ok)**
- File list / TOC / where-to-look
- “Ask-for-more” protocol: request specific file + section + reason

### Hard Limits (defaults)
- Large files are **not inlined**; use snippet extraction instead.
- Snippets are limited by:
  - max files: 6
  - max snippets per file: 3
  - context window: ±20 lines
  - max total snippet chars: 8000

### Implementation
- `dev-project-harness-loop/scripts/context-assembler/context-assembler.js`
  - produces `harness/context/context-package-<timestamp>.md`
  - extracts snippets from `*.md/*.mdx/*.txt` using ripgrep keyword hits
  - keeps small code previews size-capped
