# Proposal: 巨石代碼拆解重構

## Why

目前核心服務檔案（message.service.ts 423 行、quickCommand.ts 413 行）已成長為巨石代碼，
CSS 全站 845 行單檔、常數重複定義 3 處、日期解析函數重複 2 份，且有 22 處 `any` 型別。
這些問題正在侵蝕可維護性與可測試性，每次新增功能都增加意外回歸的風險。

## 動機

1. **God Class**：`MessageService.handleTextMessage()` 涵蓋 7 種意圖分派，211 行單方法
2. **DRY 違規**：`ALL_TAGS` 重複 3 處、日期解析重複 2 份、archive/accounting 保存邏輯重複
3. **型別安全**：22 處 `any` 散佈於核心路徑
4. **缺統一 Models**：每個頁面自力定義 interface
5. **CSS 單體**：845 行無模組化

## 範圍

共 5 個重構模組，分 3 個優先級批次：

### Batch A — 核心拆解（影響最廣、風險最高）

| # | 模組 | 目標 |
|:---|:---|:---|
| R1 | MessageService 拆解 | God Class → 策略模式 + Handler 分離 |
| R2 | 共用層建立 | Models、Constants、Utils 統一 |

### Batch B — 消除重複（中等影響）

| # | 模組 | 目標 |
|:---|:---|:---|
| R3 | QuickCommand 重構 | Command Pattern 取代 if-else 鏈 |
| R4 | any 型別清除 | 22 處 any → 正確型別 |

### Batch C — 前端重構（最低風險）

| # | 模組 | 目標 |
|:---|:---|:---|
| R5 | CSS 模組化 & 頁面元件拆解 | globals.css 拆分 + 大頁面元件化 |

## 非範圍

- 不改變任何業務邏輯行為
- 不移動 API routes 結構
- 不引入新的狀態管理框架
- 不變更資料庫 schema
