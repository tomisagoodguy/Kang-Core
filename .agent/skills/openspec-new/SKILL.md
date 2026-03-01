---
description: Start a new OpenSpec change with artifact workflow
---

Start a new change using the experimental artifact-driven approach.

**Input**: The user's request should include a change name (kebab-case) OR a description of what they want to build.

**Steps**

1. **If no clear input provided, ask what they want to build**

2. **Determine the workflow schema** - Use the default schema unless the user explicitly requests a different workflow.

3. **Create the change directory**
   ```bash
   openspec new change "<name>"
   ```

4. **Show the artifact status**
   ```bash
   openspec status --change "<name>"
   ```

5. **Get instructions for the first artifact**
   ```bash
   openspec instructions <first-artifact-id> --change "<name>"
   ```

6. **STOP and wait for user direction**

**Guardrails**
- Do NOT create any artifacts yet - just show the instructions
- Do NOT advance beyond showing the first artifact template
- If the name is invalid (not kebab-case), ask for a valid name
