# Spec C9: 收據自動分類規則 (Auto-Classification)

## 概述

系統會自動學習「商家/描述 → 標籤」的對應關係。下次遇到相同關鍵字時，跳過 Gemini，直接套用既有規則。

## 資料模型

集合名稱：`classification_rules`

| 欄位 | 型別 | 說明 |
| :--- | :--- | :--- |
| `id` | string | Firestore auto ID |
| `keyword` | string | 關鍵字（如「全聯」、「Uber」、「中油」） |
| `tag` | string | 對應標籤 |
| `subTag` | string? | 子標籤（若啟用 B4） |
| `confidence` | number | 信心指數 0-1（初始 0.8） |
| `hitCount` | number | 累計命中次數 |
| `source` | string | `auto` / `manual`（使用者手動建立 or 系統學習） |
| `createdAt` | Timestamp | 建立時間 |

## 學習流程

```text
使用者傳入文字
    ↓
1. 快速指令？ → 是 → 直接記帳（C8）
    ↓ 否
2. 檢查 classification_rules
   ├─ 匹配到規則（confidence >= 0.7）
   │   → 套用 tag，不走 Gemini 分類
   │   → hitCount++
   │   → 回覆標註「🏷 自動分類」
   └── 未匹配
       → 走 Gemini 完整分析
       → 記帳完成後
       → 從 description 提取關鍵字（前 2-4 字或商家名）
       → 自動建立新 rule（confidence=0.8, source=auto）
```

## 使用者手動修改

若使用者從 Dashboard 編輯了某筆記帳的 tag：

1. 找到對應 rule（by keyword match）
2. 若 tag 不同 → 更新 rule 的 tag
3. 若 confidence < 0.5 → 降權或刪除

## API 端點

| 方法 | 路由 | 說明 |
| :--- | :--- | :--- |
| GET | `/api/rules` | 取得所有分類規則 |
| PUT | `/api/rules/[id]` | 修改規則 |
| DELETE | `/api/rules/[id]` | 刪除規則 |

## 前端

### `/settings/rules` 管理頁面

- 列出所有分類規則
- 顯示：關鍵字、對應標籤、命中次數、信心指數
- 可手動新增/編輯/刪除
- 低 confidence 的規則標記為紅色提示

## 節省效果

假設每天 5 筆記帳，其中 3 筆是重覆商家：

- 每月節省約 90 次 Gemini API 呼叫
- 回應速度從 ~2s 降到 ~300ms
