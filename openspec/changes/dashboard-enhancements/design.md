# Design: 儀表板強化

## Phase 1: 認證保護

### 元件架構

```
src/
├── lib/firebase/auth.ts          # Firebase Auth 客戶端初始化
├── components/AuthProvider.tsx    # React Context 包裝 Auth 狀態
├── components/LoginPage.tsx      # 登入畫面
├── middleware.ts                 # Next.js Middleware (Session 驗證)
└── app/api/auth/session/route.ts # 設定/驗證 Session Cookie
```

### 資料流

1. 使用者訪問 `/` → Middleware 檢查 Session Cookie
2. 無 Cookie → 導向 `/login`
3. LoginPage 呈現 Google Sign-in 按鈕
4. 登入成功 → Firebase SDK 回傳 `idToken`
5. 呼叫 `/api/auth/session` 用 `idToken` 建立 Server-side Session Cookie
6. Middleware 用 Firebase Admin SDK 驗證 Session Cookie
7. 白名單檢查 Email，非白名單使用者拒絕

### 安全設計

- Session Cookie: `HttpOnly`, `Secure`, `SameSite=Strict`
- Cookie 有效期 5 天
- `AUTHORIZED_EMAILS` 環境變數控制白名單
- LINE Bot Webhook (`/api/webhook/*`) 不受 Middleware 限制

---

## Phase 2: 資料編輯與刪除

### API 設計

| 方法 | 路徑 | 說明 |
|:---|:---|:---|
| `PUT` | `/api/accounting/[id]` | 更新記帳條目 |
| `DELETE` | `/api/accounting/[id]` | 刪除記帳條目 |
| `PUT` | `/api/archive/[id]` | 更新存檔條目 |
| `DELETE` | `/api/archive/[id]` | 刪除存檔條目 |
| `PUT` | `/api/calendar/[id]` | 更新行事曆條目 |
| `DELETE` | `/api/calendar/[id]` | 刪除行事曆條目（同步刪除 Google Calendar） |

### 前端互動

- 每張卡片 hover 顯示「✏️ 編輯」與「🗑️ 刪除」按鈕
- 編輯：Modal 彈窗，預填現有資料，提交後 PUT API
- 刪除：確認 Dialog，確認後 DELETE API
- 操作成功後使用 `router.refresh()` 刷新 Server Component 資料

---

## Phase 3: 記帳趨勢圖表

### 元件架構

```
src/
├── components/charts/
│   ├── MonthlyTrendChart.tsx   # 近 6 個月支出折線圖 (Client Component)
│   └── TagPieChart.tsx         # 當月標籤分佈圓餅圖 (Client Component)
└── app/accounting/page.tsx     # 整合圖表 + 列表
```

### 資料流

- Server Component 從 Firestore 讀取近 6 個月資料
- 將聚合後的資料傳入 Client Component 渲染圖表
- 使用 Recharts 繪製（輕量、React 生態標準）

---

## Phase 4: 資料匯出

### API 設計

- `GET /api/export/accounting?month=2026-03` → 回傳 CSV
- `GET /api/export/accounting?from=2026-01-01&to=2026-03-31` → 日期範圍
- Response Headers: `Content-Type: text/csv`, `Content-Disposition: attachment`

### CSV 格式

```csv
日期,金額,標籤,說明,來源,建立時間
2026-03-01,150,Food,午餐便當,line,2026-03-01T12:30:00
```

### 前端

- `/accounting` 頁面新增「📥 匯出 CSV」按鈕
- 點擊後直接觸發瀏覽器下載
