# Spec 02: 資料編輯與刪除 (CRUD)

## 目標

讓使用者可以從前端修正 AI 誤判的資料，或刪除不需要的條目。

## 詳細規格

### 1. API Route 擴充

#### `src/app/api/accounting/[id]/route.ts`

- 新增 `PUT(req, { params })`: 接收 JSON body，更新 Firestore `accounting/{id}`
- 新增 `DELETE(req, { params })`: 刪除 Firestore `accounting/{id}`

#### `src/app/api/archive/[id]/route.ts`

- 新增 `PUT(req, { params })`: 更新 Firestore `archive/{id}`
- 新增 `DELETE(req, { params })`: 刪除 Firestore `archive/{id}`

#### `src/app/api/calendar/[id]/route.ts`

- 新增 `PUT(req, { params })`: 更新 Firestore `calendar/{id}`
- 修改 `DELETE(req, { params })`: 刪除 Firestore `calendar/{id}`，若有 `gcalEventId` 則同步呼叫 `deleteEventFromGoogleCalendar`

### 2. 前端元件

#### `src/components/EditModal.tsx`

- 通用的編輯 Modal 元件
- Props: `isOpen`, `onClose`, `entry`, `collection`, `fields[]`
- 表單 fieldset 依據 `fields` 動態渲染
- 提交後呼叫 PUT API，成功後 `router.refresh()` + `onClose()`

#### `src/components/DeleteConfirm.tsx`

- 確認刪除 Dialog
- Props: `isOpen`, `onClose`, `entryId`, `collection`, `label`
- 確認後呼叫 DELETE API，成功後 `router.refresh()` + `onClose()`

### 3. 卡片元件修改

#### `AccountingCard.tsx`

- 新增 hover 顯示操作按鈕（編輯 ✏️ / 刪除 🗑️）
- 轉為 `'use client'` 元件
- 點擊編輯 → 開啟 EditModal（可修改 amount, tag, date, description）
- 點擊刪除 → 開啟 DeleteConfirm

#### `ArchiveCard.tsx`

- 同上，可修改 title, summary, keywords, url

#### `CalendarCard.tsx`

- 同上，可修改 title, actionDate, actionTime, description
