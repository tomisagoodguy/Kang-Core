---
description: Sync delta specs to main specs
---

Sync delta specs from a change to main specs.

This is an **agent-driven** operation - you will read delta specs and directly edit main specs to apply the changes.

**Input**: Optionally specify a change name.

**Steps**

1. **If no change name provided, prompt for selection**

2. **Find delta specs** in `openspec/changes/<name>/specs/*/spec.md`

3. **For each delta spec, apply changes to main specs**:
   - ADDED Requirements: Add to main spec
   - MODIFIED Requirements: Update existing requirement
   - REMOVED Requirements: Remove from main spec
   - RENAMED Requirements: Rename in main spec

4. **Show summary** of what was changed

**Guardrails**
- Read both delta and main specs before making changes
- Preserve existing content not mentioned in delta
- The operation should be idempotent
