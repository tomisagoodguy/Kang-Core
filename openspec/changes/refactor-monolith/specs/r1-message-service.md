# Spec R1: MessageService 拆解

## 目標

將 `message.service.ts` 從 423 行 God Class 拆解為 ~80 行路由層 + 6 個獨立 Handler。

## 問題分析

`handleTextMessage()` 單一方法 211 行，包含：

1. 快速指令攔截
2. 規則引擎攔截
3. Gemini AI 解析
4. 5 種意圖分派（accounting / archive / calendar / recurring / query）
5. clear_memory 處理
6. Fallback chat session

此外，`handleImageMessage()` 與 `handleTextMessage()` 中的 archive / accounting 保存邏輯幾乎完全重複。

## 設計

### Handler Interface

```typescript
// src/models/handler.ts
export interface MessageContext {
    userId: string;
    originalText: string;
    sendReply: (text: string) => Promise<void>;
}

export interface MessageHandler {
    handle(data: unknown, context: MessageContext): Promise<void>;
}
```

### AccountingHandler 範例

```typescript
// src/services/handlers/accounting.handler.ts
import { MessageHandler, MessageContext } from "@/models/handler";
import { db } from "@/lib/firebase/admin";
import { ClassificationEngine } from "../classificationEngine";
import { checkBudgetAlert } from "../budget.service";
import { discordService } from "../discord.service";

export class AccountingHandler implements MessageHandler {
    async handle(parsedData: any, context: MessageContext): Promise<void> {
        const list = parsedData.accountingDataList 
            || (parsedData.accountingData ? [parsedData.accountingData] : []);

        if (list.length === 0) {
            await context.sendReply("⚠️ ...");
            return;
        }

        const batch = db.batch();
        // ... 記帳邏輯 (從 message.service.ts L86-138 搬移)
        await batch.commit();
    }
}
```

### 重構後的 MessageService

```typescript
export class MessageService {
    private handlers: Record<string, MessageHandler> = {
        accounting: new AccountingHandler(),
        archive: new ArchiveHandler(),
        calendar: new CalendarHandler(),
        recurring: new RecurringHandler(),
        query: new QueryHandler(),
    };

    async handleTextMessage(userText: string, userId: string) {
        const context = this.createContext(userId);
        
        // 快速指令攔截
        const quickResult = await parseQuickCommand(userText, userId);
        if (quickResult.handled) { ... return; }

        // 規則引擎攔截
        // ...

        // Gemini 解析
        const parsedData = await parseUserInput(userText, historyContext);
        
        // 路由到 Handler
        const handler = this.handlers[parsedData.type];
        if (handler) {
            await handler.handle(parsedData, context);
        } else {
            // Fallback: Chat Session
        }
    }
}
```

## 驗收條件

- [ ] `message.service.ts` 不超過 100 行
- [ ] 每個 Handler 獨立且可測試
- [ ] Archive 保存邏輯只有一份 (文字/圖片共用)
- [ ] 所有現有功能行為不變
