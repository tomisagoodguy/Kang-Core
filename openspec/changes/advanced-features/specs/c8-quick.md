# Spec C8: 快速記帳指令 (Quick Actions)

## 概述

在 LINE 中用固定格式指令快速操作，不走 Gemini API，提升速度並節省 API 額度。

## 指令格式

| 指令 | 語法 | 行為 |
| :--- | :--- | :--- |
| 快速記帳 | `/記 {金額} {描述}` | 直接寫入 accounting |
| 查詢摘要 | `/查 本月` | 回傳本月消費統計 |
| 查詢摘要 | `/查 上週` | 回傳上週消費統計 |
| 快速待辦 | `/待 {標題}` | 建立 calendar 待辦 |
| 產生洞察 | `/洞察` | 觸發 AI 洞察（C7） |
| 指令說明 | `/help` | 列出所有可用指令 |

## 解析邏輯

新增 `src/services/quickCommand.ts`：

```typescript
interface QuickCommandResult {
  handled: boolean;
  replyText?: string;
}

export function parseQuickCommand(text: string): QuickCommandResult
```

**流程**：

1. 判斷文字是否以 `/` 開頭
2. 若是 → 用 regex 解析指令 + 參數
3. 執行對應操作（Firestore CRUD / 查詢聚合）
4. 回傳格式化回覆文字
5. 若不是快速指令 → `{ handled: false }` → 走原有 Gemini 流程

## 記帳解析規則

```text
/記 150 午餐
     ↓ regex: /^\/記\s+(\d+)\s*(.*)$/
     金額 = 150
     描述 = 午餐
     標籤 = 自動推斷（先查 classification_rules，無則預設 Other）
     日期 = 今天
```

## Webhook 改動

在 `src/services/lineBotService.ts` 的訊息處理最前端加入：

```typescript
const quickResult = parseQuickCommand(userText);
if (quickResult.handled) {
  return reply(quickResult.replyText);
}
// 原有 Gemini 流程...
```

## 回覆格式

```text
✅ 已記帳
━━━━━━━━
💰 $150
📝 午餐
🏷 Food
📅 2026-03-01
```
