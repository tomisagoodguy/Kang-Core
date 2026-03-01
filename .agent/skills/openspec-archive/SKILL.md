---
description: Archive a completed change
---

Archive a completed change in the experimental workflow.

**Input**: Optionally specify a change name.

**Steps**

1. **If no change name provided, prompt for selection**

2. **Check artifact completion status**
   ```bash
   openspec status --change "<name>" --json
   ```

3. **Check task completion status** - Count incomplete vs complete tasks

4. **Assess delta spec sync state** - If delta specs exist, offer to sync

5. **Perform the archive**
   ```bash
   mkdir -p openspec/changes/archive
   mv openspec/changes/<name> openspec/changes/archive/YYYY-MM-DD-<name>
   ```

6. **Display summary**

**Guardrails**
- Don't block archive on warnings - just inform and confirm
- Show clear summary of what happened
