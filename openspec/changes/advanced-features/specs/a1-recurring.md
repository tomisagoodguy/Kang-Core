# Spec A1: 定期 / 固定支出 (Recurring Expenses)

## 概述

讓使用者設定每月房租、Netflix 訂閱等固定開銷，系統每天自動檢查並寫入 `accounting` 集合。

## 資料模型

集合名稱：`recurring_expenses`

| 欄位 | 型別 | 說明 |
| :--- | :--- | :--- |
| `id` | string | Firestore auto ID |
| `amount` | number | 金額 |
| `tag` | string | 分類標籤 |
| `description` | string | 說明文字 |
| `frequency` | string | `monthly` / `weekly` / `yearly` |
| `dayOfMonth` | number? | 1-31，每月幾號觸發 |
| `dayOfWeek` | number? | 0-6，每週幾觸發 |
| `monthOfYear` | number? | 1-12，每年幾月觸發（搭配 dayOfMonth） |
| `isActive` | boolean | 是否啟用 |
| `lastTriggeredAt` | Timestamp? | 上次觸發時間（防重複） |
| `createdAt` | Timestamp | 建立時間 |

## API 端點

### CRUD

| 方法 | 路由 | 說明 |
| :--- | :--- | :--- |
| GET | `/api/recurring` | 取得所有定期支出 |
| POST | `/api/recurring` | 新增定期支出 |
| PUT | `/api/recurring/[id]` | 編輯 |
| DELETE | `/api/recurring/[id]` | 刪除 |

### Cron 觸發

| 路由 | 排程 | 說明 |
| :--- | :--- | :--- |
| `/api/cron/recurring` | 每天 00:05 UTC+8 | 掃描 `recurring_expenses`，到期的寫入 `accounting` |

**防重複邏輯**：比較 `lastTriggeredAt` 與當前日期，同一天不重複觸發。

## 前端

- 新增 `/recurring` 頁面
- 列表顯示所有定期支出（含啟用/停用 toggle）
- 新增 Modal（金額、標籤、頻率、日期選擇）
- Navbar 新增入口
