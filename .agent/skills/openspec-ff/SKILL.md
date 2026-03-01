---
description: Fast-forward through artifact creation
---

Fast-forward through artifact creation - generate everything needed to start implementation in one go.

**Input**: Change name (kebab-case) OR a description of what the user wants to build.

**Steps**

1. **If no input provided, ask what they want to build**

2. **Create the change directory**
   ```bash
   openspec new change "<name>"
   ```

3. **Get the artifact build order**
   ```bash
   openspec status --change "<name>" --json
   ```

4. **Create artifacts in sequence until apply-ready**
   - For each ready artifact, get instructions and create it
   - Continue until all `applyRequires` artifacts are complete

5. **Show final status**

**Guardrails**
- Create ALL artifacts needed for implementation
- Always read dependency artifacts before creating a new one
- If context is unclear, ask the user
