# Spec 03: 記帳趨勢圖表 (Analytics)

## 目標

在 `/accounting` 頁面加入視覺化圖表，讓使用者一眼看出消費趨勢。

## 詳細規格

### 1. 安裝依賴

```bash
yarn add recharts
```

### 2. 資料聚合（Server Side）

在 `src/app/accounting/page.tsx`：

- 查詢近 6 個月的 accounting 資料
- 聚合為兩種結構：
  - **月度趨勢**: `{ month: "2026-01", total: 15000 }[]`
  - **標籤分佈**: `{ tag: "Food", total: 8500 }[]`（只算當月）

### 3. 圖表元件

#### `src/components/charts/MonthlyTrendChart.tsx`

- `'use client'` 元件
- Props: `data: { month: string, total: number }[]`
- 使用 Recharts `<ResponsiveContainer>` + `<LineChart>`
- X 軸: 月份，Y 軸: 金額
- 風格: 深色背景，漸層線條，hover 顯示金額

#### `src/components/charts/TagPieChart.tsx`

- `'use client'` 元件
- Props: `data: { tag: string, total: number }[]`
- 使用 Recharts `<PieChart>` + `<Cell>`
- 每個標籤對應一個顏色
- hover 顯示金額與百分比

### 4. 頁面整合

`src/app/accounting/page.tsx`:

- 頂部放兩個圖表（並排或上下排列，RWD）
- 下方維持現有的記帳列表
