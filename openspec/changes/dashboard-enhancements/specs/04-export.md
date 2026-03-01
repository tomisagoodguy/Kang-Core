# Spec 04: 資料匯出 (CSV Export)

## 目標

提供 CSV 匯出端點，使用者可從前端下載記帳資料。

## 詳細規格

### 1. API Route

#### `src/app/api/export/accounting/route.ts`

- `GET` 方法
- Query Parameters:
  - `month` (可選): `YYYY-MM` 格式，篩選該月份
  - `from` (可選): `YYYY-MM-DD` 格式，起始日期
  - `to` (可選): `YYYY-MM-DD` 格式，結束日期
  - 若都未提供，預設匯出當月
- Response:
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="accounting-2026-03.csv"`
  - Body: UTF-8 BOM + CSV 內容

### 2. CSV 格式

```
日期,金額,標籤,說明,來源,建立時間
2026-03-01,150,Food,午餐便當,line,2026-03-01T12:30:00
```

- 欄位順序: date, amount, tag, description, source, createdAt
- 中文欄位 header
- 使用 UTF-8 BOM (`\uFEFF`) 確保 Excel 正確開啟中文

### 3. 前端整合

在 `src/app/accounting/page.tsx`:

- 新增「📥 匯出 CSV」按鈕（Client Component）
- 點擊後直接 `window.open('/api/export/accounting?month=...')`
- 瀏覽器自動下載
