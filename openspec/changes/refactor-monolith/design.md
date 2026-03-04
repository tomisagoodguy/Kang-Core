# Design: 巨石代碼拆解重構

## 架構圖

```
src/
├── models/                          # 🆕 統一型別層
│   ├── schema.ts                    # (既有)
│   ├── accounting.ts                # AccountingEntry interface
│   ├── archive.ts                   # ArchiveEntry interface
│   ├── calendar.ts                  # CalendarEntry interface
│   ├── recurring.ts                 # RecurringExpense interface
│   └── tags.ts                      # CustomTag, ALL_TAGS constant
│
├── utils/                           # 🆕 共用工具
│   ├── tagEmoji.ts                  # (既有)
│   ├── constants.ts                 # ALL_TAGS, PARENT_TAGS 等
│   └── dateRange.ts                 # 統一日期範圍解析 (合併 parsePeriod + resolvePeriod)
│
├── services/
│   ├── message.service.ts           # 🔧 精簡為事件路由 (~80 行)
│   ├── handlers/                    # 🆕 Handler 層 (從 message.service 拆出)
│   │   ├── accounting.handler.ts    # 記帳意圖處理
│   │   ├── archive.handler.ts       # 存檔意圖處理
│   │   ├── calendar.handler.ts      # 行事曆意圖處理
│   │   ├── recurring.handler.ts     # 定期支出意圖處理
│   │   ├── query.handler.ts         # 查詢意圖處理
│   │   └── image.handler.ts         # 圖片/檔案處理
│   ├── commands/                    # 🆕 Command Pattern (從 quickCommand 拆出)
│   │   ├── registry.ts              # 指令註冊/分派中心
│   │   ├── expense.command.ts       # /記
│   │   ├── query.command.ts         # /查
│   │   ├── todo.command.ts          # /待
│   │   ├── insight.command.ts       # /洞察
│   │   ├── budget.command.ts        # /預算
│   │   ├── archive-query.command.ts # /問
│   │   └── files.command.ts         # /recent_files
│   ├── quickCommand.ts              # 🔧 精簡為 registry 入口 (~30 行)
│   ├── queryEngine.ts               # 🔧 使用統一 dateRange
│   └── ...
│
├── app/
│   ├── globals.css                  # 🔧 精簡為 base + tokens (~200 行)
│   ├── styles/                      # 🆕 CSS 模組拆分
│   │   ├── navbar.css
│   │   ├── cards.css
│   │   ├── modal.css
│   │   ├── forms.css
│   │   └── login.css
│   └── ...
```

## R1: MessageService 拆解策略

### Before (巨石)

```
MessageService
├── sendReply()
├── handleTextMessage()    ← 211 行, 7 種意圖
├── handleImageMessage()   ← 74 行
├── handleFileMessage()    ← 55 行
└── processEvent()         ← 46 行
```

### After (Handler 分離)

```
MessageService (路由層, ~80 行)
├── sendReply()
├── processEvent()
└── routeTextMessage() → 委派到:
    ├── AccountingHandler.handle()
    ├── ArchiveHandler.handle()
    ├── CalendarHandler.handle()
    ├── RecurringHandler.handle()
    ├── QueryHandler.handle()
    └── ImageHandler.handle()
```

每個 Handler 實作共用的 `MessageHandler` interface:

```typescript
interface MessageHandler {
    handle(context: MessageContext): Promise<void>;
}

interface MessageContext {
    userId: string;
    originalText: string;
    sendReply: (text: string) => Promise<void>;
}
```

## R2: 共用層

### constants.ts

```typescript
export const ALL_TAGS = ["Food", "Transport", "Entertainment", "Utilities", "Shopping", "Health", "Education", "Other"] as const;
export type TagName = typeof ALL_TAGS[number];
```

### dateRange.ts (合併 parsePeriod + resolvePeriod)

```typescript
export function resolveDateRange(period: string): { from: string; to: string; label: string } | null
```

## R3: QuickCommand → Command Pattern

### Before

```typescript
// parseQuickCommand: 90 行 if-else 鏈
if (/^\/help$/i.test(trimmed)) { ... }
if (/^\/洞察$/i.test(trimmed)) { ... }
const expenseMatch = trimmed.match(/^\/記\s+(\d+)\s*(.*)$/);
// ... 9 個分支
```

### After

```typescript
// registry.ts
const commands: Command[] = [
    new ExpenseCommand(),
    new QueryCommand(),
    new TodoCommand(),
    // ...
];

export function parseQuickCommand(text: string, userId: string) {
    for (const cmd of commands) {
        if (cmd.matches(text)) return cmd.execute(text, userId);
    }
    return { handled: false };
}
```

## R5: CSS 模組化

globals.css **845 行**拆解為：

| 檔案 | 內容 | 行數估計 |
|:---|:---|:---:|
| `globals.css` | CSS Variables + Reset + Body + Typography | ~120 |
| `styles/navbar.css` | Navbar 相關 | ~60 |
| `styles/cards.css` | glass-card, stat-card, accounting-card, archive-card | ~180 |
| `styles/modal.css` | Modal overlay, card, form fields, buttons | ~120 |
| `styles/forms.css` | Filter bar, select, input | ~60 |
| `styles/login.css` | Login page, spinner, animations | ~100 |
