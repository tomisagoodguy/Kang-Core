---
description: Archive multiple changes at once
---

Archive multiple completed changes in a single operation.

**Steps**

1. **Get active changes** - `openspec list --json`

2. **Prompt for change selection** - Multi-select

3. **Batch validation** - Gather status for all selected changes

4. **Detect spec conflicts** - Map capabilities to changes

5. **Resolve conflicts agentically** - Check codebase for implementation evidence

6. **Show consolidated status table**

7. **Confirm batch operation**

8. **Execute archive for each confirmed change**

9. **Display summary**

**Guardrails**
- Always prompt for selection, never auto-select
- Detect spec conflicts early and resolve by checking codebase
