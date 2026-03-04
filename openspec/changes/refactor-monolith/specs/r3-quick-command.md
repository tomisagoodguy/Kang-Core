# Spec R3: QuickCommand 重構

## 目標

將 `quickCommand.ts` 413 行的 if-else 巨石，重構為 Command Pattern，使每個指令獨立可測試。

## 問題分析

`parseQuickCommand()` (L20-110) 用 9 個 if/regex 分支處理所有快速指令：

```
/help → inline 回傳
/洞察 → handleQuickInsight()
/記   → handleQuickExpense()
/查   → handleQuickQuery()
/待   → handleQuickTodo()
/完成 → completeTodo()
/recent_files → handleRecentFiles()
/問   → handleArchiveQuery()
/預算 → handleBudgetQuery() / handleBudgetSet()
```

新增指令需要：修改 `parseQuickCommand()` + 新增 handler 函數。違反 **Open/Closed Principle**。

此外 `guessTag()` (L242-259) 硬編碼了大量中文關鍵字對照規則，
與 `ClassificationEngine.match()` 功能完全重疊。

## 設計

### Command Interface

```typescript
// src/services/commands/registry.ts
export interface Command {
    name: string;
    pattern: RegExp;
    description: string;
    execute(text: string, userId: string): Promise<QuickCommandResult>;
}
```

### 指令註冊

```typescript
// registry.ts
import { ExpenseCommand } from "./expense.command";
import { QueryCommand } from "./query.command";
// ...

const commands: Command[] = [
    new ExpenseCommand(),
    new QueryCommand(),
    new TodoCommand(),
    new CompleteCommand(),
    new InsightCommand(),
    new BudgetCommand(),
    new ArchiveQueryCommand(),
    new RecentFilesCommand(),
    new HelpCommand(),     // /help 也可以自動列出所有已註冊 commands 的 description
];

export function parseQuickCommand(text: string, userId: string): Promise<QuickCommandResult> {
    const trimmed = text.trim();
    if (!trimmed.startsWith("/")) return Promise.resolve({ handled: false });

    for (const cmd of commands) {
        if (cmd.pattern.test(trimmed)) {
            return cmd.execute(trimmed, userId);
        }
    }

    return Promise.resolve({
        handled: true,
        replyText: `❓ 不認識的指令「${trimmed.split(" ")[0]}」\n\n輸入 /help 看所有指令`,
    });
}
```

### 單個 Command 範例

```typescript
// src/services/commands/expense.command.ts
export class ExpenseCommand implements Command {
    name = "記帳";
    pattern = /^\/記\s+(\d+)\s*(.*)$/;
    description = "💰 /記 {金額} {說明} — 快速記帳";

    async execute(text: string, userId: string): Promise<QuickCommandResult> {
        const match = text.match(this.pattern)!;
        const amount = Number(match[1]);
        const description = match[2].trim() || "快速記帳";
        // ... 記帳邏輯
    }
}
```

### `guessTag()` 廢止

呼叫 `ClassificationEngine.match()` 取代 `guessTag()`。
若 match 回傳 null 則預設 `"Other"`。

## 驗收條件

- [ ] `quickCommand.ts` 入口不超過 30 行
- [ ] 每個指令一個獨立檔案
- [ ] 新增指令只需建立 Command class 並註冊到 registry
- [ ] `/help` 自動列出所有已註冊指令的 description
- [ ] `guessTag()` 函數已移除
