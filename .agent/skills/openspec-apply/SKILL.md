---
description: Implement tasks from an OpenSpec change
---

Implement tasks from an OpenSpec change.

**Input**: Optionally specify a change name. If vague or ambiguous, prompt for available changes.

**Steps**

1. **Select the change** - Infer from context or prompt user

2. **Check status**
   ```bash
   openspec status --change "<name>" --json
   ```

3. **Get apply instructions**
   ```bash
   openspec instructions apply --change "<name>" --json
   ```

4. **Read context files** from the apply instructions output

5. **Implement tasks** - Loop through tasks, mark complete as you go

6. **On completion, show status** and suggest archive with `/opsx:archive`

**Guardrails**
- Keep going through tasks until done or blocked
- If task is ambiguous, pause and ask before implementing
- Keep code changes minimal and scoped to each task
