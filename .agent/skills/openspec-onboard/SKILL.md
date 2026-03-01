---
description: Guided onboarding for OpenSpec workflow
---

Guide the user through their first complete OpenSpec workflow cycle.

## Preflight
Check if OpenSpec is initialized:
```bash
openspec status --json 2>&1 || echo "NOT_INITIALIZED"
```

## Phases

1. **Welcome** - Explain what we'll do
2. **Task Selection** - Find a small, real task in the codebase
3. **Explore Demo** - Brief exploration of the relevant code
4. **Create Change** - `openspec new change "<name>"`
5. **Proposal** - Draft and save proposal.md
6. **Specs** - Create spec files
7. **Design** - Draft design.md
8. **Tasks** - Create tasks.md
9. **Apply** - Implement each task
10. **Archive** - Archive the completed change
11. **Recap** - Summarize and show command reference

**Guardrails**
- Follow the EXPLAIN → DO → SHOW → PAUSE pattern
- Don't skip phases even if the change is small
- Handle exits gracefully
