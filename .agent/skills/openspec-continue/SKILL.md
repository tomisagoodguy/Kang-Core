---
description: Continue working on an OpenSpec change
---

Continue working on a change by creating the next artifact.

**Input**: Optionally specify a change name. If omitted, prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**
   Run `openspec list --json` and let the user select.

2. **Check current status**
   ```bash
   openspec status --change "<name>" --json
   ```

3. **Act based on status**:
   - If all artifacts complete: Congratulate and suggest implementation with `/opsx:apply` or archive with `/opsx:archive`
   - If artifacts ready: Get instructions and create ONE artifact
   - If blocked: Show status and suggest checking for issues

4. **After creating an artifact, show progress**

**Guardrails**
- Create ONE artifact per invocation
- Always read dependency artifacts before creating a new one
- Never skip artifacts or create out of order
