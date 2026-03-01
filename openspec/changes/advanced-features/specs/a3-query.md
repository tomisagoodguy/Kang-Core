# Spec A3: 對話式查詢 (Conversational Query)

## 概述

讓使用者在 LINE 中用自然語言查詢資料，例如「這個月吃飯花多少」、「明天有什麼事」。

## 意圖分類

在 Gemini System Prompt 中新增 `query` 意圖類型：

| 使用者輸入 | 解析結果 |
| :--- | :--- |
| 這個月吃飯花多少 | `{ intent: "query_expense", tag: "Food", period: "this_month" }` |
| 上個月交通費 | `{ intent: "query_expense", tag: "Transport", period: "last_month" }` |
| 上週花了多少 | `{ intent: "query_expense", tag: null, period: "last_week" }` |
| 最近收藏了什麼 | `{ intent: "query_archive", limit: 5 }` |
| 明天有什麼事 | `{ intent: "query_calendar", date: "tomorrow" }` |
| 本月消費最高的一筆 | `{ intent: "query_expense_max", period: "this_month" }` |

## Gemini Prompt 擴充

在現有 System Prompt 底部加入：

```text
若使用者意圖為「查詢」而非「記錄」，回傳：
{
  "type": "query",
  "queryType": "expense" | "archive" | "calendar",
  "filters": {
    "tag": "...",
    "period": "this_month" | "last_month" | "this_week" | "last_week" | "today" | "tomorrow",
    "limit": 5,
    "sort": "desc"
  }
}
```

## 查詢引擎

新增 `src/services/queryEngine.ts`：

1. 接收 Gemini 解析出的 query 結構
2. 將 period 轉換為日期範圍
3. 查詢 Firestore 並聚合
4. 格式化為 LINE 文字回覆

## 回覆格式

```text
📊 本月「Food」消費統計
━━━━━━━━━━━
📝 共 12 筆
💰 合計 $4,350
📈 平均每筆 $363
🏆 最高: $890 (聚餐)
```
