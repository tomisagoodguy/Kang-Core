# Spec C7: AI 消費洞察 (AI Insights)

## 概述

利用 Gemini 分析每月消費資料，產出具體可行的個人化建議，而不只是圖表。

## 觸發方式

| 場景 | 觸發 | 顯示位置 |
| :--- | :--- | :--- |
| 月報推播 | `/api/cron/monthly-report` | LINE Flex Message 底部 |
| Dashboard | 首頁 or 記帳頁 | 「AI 洞察」卡片 |
| 手動觸發 | LINE 指令 `/洞察` | LINE 回覆 |

## API 端點

| 方法 | 路由 | 說明 |
| :--- | :--- | :--- |
| GET | `/api/insights?month=2026-03` | 產生指定月份的 AI 洞察 |

## Gemini Prompt

```text
你是一位個人理財顧問。以下是使用者 {month} 的消費資料（JSON）：
{data}

上個月的總支出為 ${lastMonthTotal}。

請用繁體中文分析，回覆 JSON 格式：
{
  "summary": "一句話總結本月消費狀況",
  "highlights": [
    { "icon": "emoji", "text": "具體發現" }
  ],
  "suggestion": "一條具體可行的省錢建議",
  "comparedToLastMonth": "+15%" 或 "-8%"
}

限制：最多 4 條 highlights，每條不超過 30 字。
```

## 前端元件

### `src/components/InsightCard.tsx`

- 放在記帳頁圖表區下方
- 玻璃卡片風格
- 若該月尚未產生洞察 → 顯示「🧠 產生 AI 分析」按鈕
- 已產生 → 顯示 highlights 列表 + 建議

## 快取

洞察結果儲存到 Firestore `insights` 集合，key 為 `{month}`，避免重複呼叫 Gemini。
