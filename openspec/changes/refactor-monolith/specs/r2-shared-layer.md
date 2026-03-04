# Spec R2: 共用層建立

## 目標

消除常數重複定義（`ALL_TAGS` ×3）、日期解析函數重複（`parsePeriod` + `resolvePeriod`），
建立統一的 Models 層取代各頁面散落的 interface 定義。

## 問題分析

### 常數重複

```
ALL_TAGS 定義在:
  ├── src/app/accounting/page.tsx     L9
  ├── src/app/recurring/page.tsx      L5
  └── src/app/settings/rules/page.tsx L16
PARENT_TAGS (同義):
  └── src/app/settings/tags/page.tsx  L5
```

### 日期解析重複

```
parsePeriod()   → src/services/quickCommand.ts   L262-299 (中文: 本月/上月/本週/上週/今天)
resolvePeriod() → src/services/queryEngine.ts     L216-261 (英文: this_month/last_month/...)
```

功能相同，只是輸入格式不同。應合併為一個統一函數。

### 散落的 Interface 定義

| Interface | 定義位置 |
|:---|:---|
| `AccountingEntry` | `accounting/page.tsx` L21-31 |
| `CustomTag` | `accounting/page.tsx` L33-37, `settings/tags/page.tsx` L7-11 |
| `RecurringExpense` | `recurring/page.tsx` L7-18 |
| `Rule` | `settings/rules/page.tsx` L5-14 |

## 設計

### `src/utils/constants.ts`

```typescript
export const ALL_TAGS = [
    "Food", "Transport", "Entertainment", "Utilities",
    "Shopping", "Health", "Education", "Other"
] as const;

export type TagName = typeof ALL_TAGS[number];
```

### `src/utils/dateRange.ts`

```typescript
interface DateRange {
    from: string;
    to: string;
    label: string;
}

const ALIASES: Record<string, string> = {
    "本月": "this_month", "這個月": "this_month",
    "上月": "last_month", "上個月": "last_month",
    "本週": "this_week", "這週": "this_week",
    "上週": "last_week",
    "今天": "today", "今日": "today",
};

export function resolveDateRange(period: string): DateRange | null {
    const normalized = ALIASES[period] ?? period;
    // ... 統一實作
}
```

### Model 檔案範例 (`src/models/accounting.ts`)

```typescript
import { TagName } from "@/utils/constants";

export interface AccountingEntry {
    id: string;
    amount: number;
    tag: TagName;
    subTag?: string;
    date: string;
    description?: string;
    originalText?: string;
    imageUrl?: string;
    source?: string;
    createdAt?: string | Date;
}
```

## 驗收條件

- [ ] `ALL_TAGS` 只在 `constants.ts` 定義一次
- [ ] 日期範圍解析只有 `resolveDateRange()` 一份
- [ ] 所有頁面使用統一 model import，無自行定義的 interface
