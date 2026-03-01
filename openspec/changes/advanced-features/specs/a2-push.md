# Spec A2: LINE 主動推播 (Proactive Push)

## 概述

透過 Vercel Cron Job + LINE Push API，主動推播每日消費摘要、行事曆提醒、月報。

## 推播時程

| Cron 路由 | UTC 排程 | 本地時間 | 推播內容 |
| :--- | :--- | :--- | :--- |
| `/api/cron/daily-summary` | `0 13 * * *` | 21:00 | 今日消費統計 + 本月累計 |
| `/api/cron/calendar-remind` | `0 0 * * *` | 08:00 | 今日行事曆清單 |
| `/api/cron/monthly-report` | `0 1 1 * *` | 每月1日 09:00 | 上月完整月報 |

## 認證機制

每個 Cron 端點使用 `CRON_SECRET` 環境變數驗證（Vercel 自動帶入 `Authorization: Bearer <secret>`）。

## 推播格式

### 每日消費摘要

```text
📊 今日消費摘要
━━━━━━━━━━━━
💰 今日共 3 筆，合計 $850
🍽 Food: $450
🚗 Transport: $250
🛒 Shopping: $150
━━━━━━━━━━━━
📅 本月累計: $12,350 / 預算 $20,000
```

### 行事曆提醒

```text
🗓 今日行程提醒
━━━━━━━━━━━━
⏰ 10:00 團隊會議
⏰ 15:00 牙醫回診
📌 待辦：繳電費
```

### 月報

使用 Flex Message 卡片，包含：

- 月度總支出
- 標籤分佈圓餅圖（以 emoji 模擬）
- 同比上月增減
- AI 洞察（若啟用 C7）

## 實作細節

1. 使用 LINE Messaging API 的 `pushMessage` 方法
2. `LINE_USER_ID` 存於環境變數（單一使用者）
3. Vercel Cron 設定在 `vercel.json` 的 `crons` 陣列
4. 查詢 Firestore 聚合今日/本月資料
