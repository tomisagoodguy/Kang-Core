# Design: 進階功能總設計

## 架構概覽

```text
LINE Bot ──→ Webhook ──→ Gemini 意圖解析
                │
                ├─→ 快速指令 (/記, /查) → 直接 CRUD
                ├─→ 對話查詢 → Firestore Query → 回覆
                ├─→ 一般記帳/存檔/行事曆 → 現有流程
                └─→ 收據 OCR → 規則引擎 → 自動分類
                
Scheduler (Cron) ──→ LINE Push API
                      ├─→ 每日消費摘要
                      ├─→ 行事曆提醒
                      └─→ 月報推送

Next.js Dashboard
  ├─→ PWA (manifest.json + SW)
  ├─→ 深色/淺色 Toggle
  ├─→ 自訂標籤管理頁
  ├─→ 定期支出管理頁
  └─→ AI 洞察卡片
```

---

## Batch A 設計

### A1: 定期支出 (Recurring Expenses)

**資料模型** — `recurring_expenses` collection：

```typescript
interface RecurringExpense {
  id: string;
  amount: number;
  tag: string;
  description: string;
  frequency: "monthly" | "weekly" | "yearly";
  dayOfMonth?: number;     // 1-31, for monthly
  dayOfWeek?: number;      // 0-6, for weekly
  monthOfYear?: number;    // 1-12, for yearly
  isActive: boolean;
  lastTriggeredAt?: Timestamp;
  createdAt: Timestamp;
}
```

**觸發機制**：Vercel Cron Job → 每天 00:00 UTC+8 檢查 → 到期的自動寫入 `accounting`。

**前端**：新增 `/recurring` 頁面，列表 CRUD + 啟用/停用 toggle。

### A2: LINE 主動推播 (Proactive Push)

**API 端點**：

| 路由 | 觸發 | 內容 |
| :--- | :--- | :--- |
| `/api/cron/daily-summary` | 每日 21:00 | 今日消費統計 + 本月累計 |
| `/api/cron/calendar-remind` | 每日 08:00 | 今日行事曆提醒 |
| `/api/cron/monthly-report` | 每月 1 日 09:00 | 上月完整月報 |

**推播格式**：LINE Flex Message，視覺化卡片（不是純文字）。

**Vercel Cron 設定** — `vercel.json`：

```json
{
  "crons": [
    { "path": "/api/cron/daily-summary", "schedule": "0 13 * * *" },
    { "path": "/api/cron/calendar-remind", "schedule": "0 0 * * *" },
    { "path": "/api/cron/monthly-report", "schedule": "0 1 1 * *" }
  ]
}
```

> 時間為 UTC，+8 後分別是 21:00、08:00、09:00

### A3: 對話式查詢 (Conversational Query)

**意圖分類**：在 Gemini prompt 加入新的意圖 `query`。

| 使用者說 | 意圖 | 查詢邏輯 |
| :--- | :--- | :--- |
| 這個月吃飯花多少 | `query_expense` | Firestore: tag=Food, date 本月 |
| 上週花了多少 | `query_expense` | Firestore: date 上週範圍 |
| 最近收藏了什麼 | `query_archive` | Firestore: archive orderBy createdAt desc limit 5 |
| 明天有什麼事 | `query_calendar` | Firestore: actionDate = 明天 |

**回傳**：格式化的文字或 Flex Message。

---

## Batch B 設計

### B4: 自訂標籤 / 子分類

**資料模型** — `custom_tags` collection：

```typescript
interface CustomTag {
  id: string;
  name: string;          // "手搖飲"
  parentTag: string;     // "Food"
  color?: string;
  icon?: string;
  createdAt: Timestamp;
}
```

**前端**：現有 tag filter dropdown 改為兩層（主分類 → 子分類）。新增 `/settings/tags` 管理頁。

### B5: PWA

**需要的檔案**：

- `public/manifest.json` — App name、icon、theme color、start_url
- `public/sw.js` — Service Worker（快取策略：network-first）
- `src/app/layout.tsx` — `<link rel="manifest">`
- `public/icons/` — 192x192 + 512x512 icon

### B6: 深色/淺色切換

**實作方式**：

- CSS Variables 分兩組（`data-theme="dark"` / `data-theme="light"`）
- `localStorage` 儲存偏好
- Navbar 加 toggle 按鈕
- 預設跟隨系統 `prefers-color-scheme`

---

## Batch C 設計

### C7: AI 消費洞察

**觸發**：月報推播時附帶，或在 Dashboard 首頁顯示。

**Prompt 範本**：

```text
以下是使用者 {month} 的消費資料（JSON）：{data}
請用繁體中文分析：
1. 主要消費集中在哪些分類
2. 與上個月相比的增減趨勢
3. 是否有異常高額消費
4. 一條具體可行的省錢建議
回覆限制 200 字以內。
```

### C8: 快速記帳指令

**格式**：`/記 {金額} {描述}` — 不走 Gemini，直接用 regex 解析。

| 指令 | 行為 |
| :--- | :--- |
| `/記 150 午餐` | 寫入 accounting: amount=150, description=午餐, tag=Food(auto) |
| `/查 本月` | 回傳本月消費統計 |
| `/查 上週` | 回傳上週消費統計 |

**優點**：節省 Gemini API 呼叫、回應更快（< 500ms）。

### C9: 收據自動分類規則

**資料模型** — `classification_rules` collection：

```typescript
interface ClassificationRule {
  id: string;
  keyword: string;     // "全聯", "Uber", "中油"
  tag: string;         // "Food", "Transport"
  subTag?: string;     // "食材", "計程車"
  confidence: number;  // 0-1, 自動學習權重
  hitCount: number;    // 累計命中次數
  createdAt: Timestamp;
}
```

**學習流程**：

1. 每次記帳時，檢查 `description` 是否匹配已有規則
2. 若匹配 → 自動套用 tag（不走 Gemini 分類）
3. 若不匹配 → 走 Gemini → 記帳完成後自動建立新規則
4. 使用者手動修改 tag → 更新規則權重
