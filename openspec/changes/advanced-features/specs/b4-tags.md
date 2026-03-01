# Spec B4: 自訂標籤 / 子分類

## 概述

讓使用者自行建立子標籤（如 Food → 外食/食材/飲料），提升消費分析的顆粒度。

## 資料模型

集合名稱：`custom_tags`

| 欄位 | 型別 | 說明 |
| :--- | :--- | :--- |
| `id` | string | Firestore auto ID |
| `name` | string | 子標籤名稱（如「手搖飲」） |
| `parentTag` | string | 父標籤（如 `Food`） |
| `color` | string? | 自訂顏色 hex |
| `icon` | string? | Emoji icon |
| `createdAt` | Timestamp | 建立時間 |

## API 端點

| 方法 | 路由 | 說明 |
| :--- | :--- | :--- |
| GET | `/api/tags` | 取得所有自訂標籤 |
| POST | `/api/tags` | 新增子標籤 |
| PUT | `/api/tags/[id]` | 編輯 |
| DELETE | `/api/tags/[id]` | 刪除 |

## 前端

### `/settings/tags` 管理頁面

- 左欄：父標籤列表（8 個固定）
- 右欄：選中父標籤的子標籤列表 + 新增按鈕
- 每個子標籤可編輯名稱、顏色、icon

### 記帳頁面改動

- Tag filter 增加兩層：選中父標籤後可展開子標籤
- `accounting` 紀錄新增 `subTag` 可選欄位
- Gemini 記帳分析時，嘗試匹配已有子標籤

## 向下相容

- `subTag` 為可選欄位，舊資料不受影響
- 圖表聚合時，若選擇某父標籤，自動包含其所有子標籤
