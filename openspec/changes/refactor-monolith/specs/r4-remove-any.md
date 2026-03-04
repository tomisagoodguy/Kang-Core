# Spec R4: any 型別清除

## 目標

消除全專案 22 處 `any` 型別使用，提升型別安全性。

## 清除清單

### 優先級 1：核心業務路徑

| 檔案 | 行號 | 現況 | 修正方式 |
|:---|:---:|:---|:---|
| `message.service.ts` | L147 | `const entry: any = { ...archiveData }` | → `ArchiveEntry & { embedding?: number[] }` |
| `message.service.ts` | L292 | `const entry: any = { ...archiveData }` | → 同上 (合併後只存在一份) |
| `message.service.ts` | L350 | `const entry: any = { ...fileData }` | → 同上 |
| `insights.ts` | L39 | `acc: any, curr: any` | → `Record<string, number>`, `AccountingEntry` |

### 優先級 2：Gemini SDK 整合

| 檔案 | 行號 | 現況 | 修正方式 |
|:---|:---:|:---|:---|
| `parser.ts` | L232 | `let lastError: any` | → `unknown` |
| `parser.ts` | L244 | `catch (err: any)` | → `catch (err: unknown)` + type guard |
| `parser.ts` | L257 | `catch (err: any)` | → `catch (err: unknown)` + type guard |
| `vision.ts` | L63 | `let lastError: any` | → `unknown` |
| `vision.ts` | L91 | `catch (err: any)` | → `catch (err: unknown)` + type guard |
| `client.ts` | L32 | `catch (error: any)` | → `catch (error: unknown)` |
| `sessionManager.ts` | L31 | `const tools: any[]` | → Gemini SDK 的 `Tool[]` 型別 |
| `fileManager.ts` | L24 | `(c: any)` | → Gemini SDK 的 `Corpus` 型別 |

### 優先級 3：Google API 整合

| 檔案 | 行號 | 現況 | 修正方式 |
|:---|:---:|:---|:---|
| `calendar/client.ts` | L34 | `catch (e: any)` | → `catch (e: unknown)` |
| `calendar/client.ts` | L55-56 | `let start: any, end: any` | → `{ date: string } \| { dateTime: string }` |
| `calendar/client.ts` | L85 | `catch (e: any)` | → `catch (e: unknown)` |
| `drive/client.ts` | L73 | `const media: any` | → Drive API 的 `{ body: Readable }` |

### 優先級 4：前端元件

| 檔案 | 行號 | 現況 | 修正方式 |
|:---|:---:|:---|:---|
| `page.tsx` | L147 | `(entry: any)` | → `CalendarEntry` |
| `page.tsx` | L169 | `(entry: any)` | → `AccountingEntry` |
| `page.tsx` | L191 | `(entry: any)` | → `ArchiveEntry` |
| `archive/route.ts` | L31 | `(entry: any)` | → `ArchiveEntry` |
| `TagPieChart.tsx` | L62 | `(props: any)` | → `ActiveShapeProps` interface |

## Type Guard 範例

```typescript
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}
```

## 驗收條件

- [ ] `rg ': any'` 在 `src/` 目錄中回傳 0 結果
- [ ] TypeScript strict mode 下無新增的型別錯誤
