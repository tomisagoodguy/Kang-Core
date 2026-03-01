---
description: Verify implementation matches artifacts
---

Verify that an implementation matches the change artifacts.

**Input**: Optionally specify a change name.

**Steps**

1. **If no change name provided, prompt for selection**

2. **Check status** to understand the schema

3. **Load artifacts** from contextFiles

4. **Verify Completeness** - Task completion and spec coverage

5. **Verify Correctness** - Requirement implementation and scenario coverage

6. **Verify Coherence** - Design adherence and pattern consistency

7. **Generate Verification Report** with CRITICAL/WARNING/SUGGESTION issues

**Guardrails**
- Focus on objective checklist items
- Every issue must have a specific recommendation
