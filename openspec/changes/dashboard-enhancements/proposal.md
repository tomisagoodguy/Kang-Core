# Proposal: 儀表板強化四部曲

## 動機

目前 Kang-Core 的核心功能（LINE Bot → AI 記帳/收納/行事曆）已基本完成，但儀表板仍缺乏以下關鍵能力，導致系統安全性與實用性不足：

1. **無認證保護**：任何人知道 URL 即可查看所有私人資料。
2. **無法編輯/刪除**：AI 分類或金額解析錯誤時，無法修正。
3. **缺少趨勢分析**：只有原始數據列表，無法直觀看見消費趨勢。
4. **無法匯出資料**：記帳資料無法用於報稅、備份或深度分析。

## 範圍

本次變更涵蓋四大功能模組，依序實作：

### Phase 1: 認證保護 (Auth Guard)

- 使用 Firebase Auth (Google Sign-in) 保護前端頁面
- 透過 Next.js Middleware 做路由層級守衛
- 限制僅特定 Email 可登入（白名單機制）

### Phase 2: 資料編輯與刪除 (CRUD)

- 各 Collection（accounting, archive, calendar）支援 PUT（編輯）和 DELETE
- 前端卡片加入「編輯」和「刪除」按鈕
- 刪除 calendar 條目時同步刪除 Google Calendar 事件

### Phase 3: 記帳趨勢圖表 (Analytics)

- `/accounting` 頁面新增月度趨勢折線圖
- 新增按標籤分類的圓餅圖
- 使用 Recharts 進行前端圖表渲染

### Phase 4: 資料匯出 (Export)

- 新增 `/api/export/accounting` 端點，回傳 CSV
- 支援依月份、日期範圍篩選
- 前端新增「匯出 CSV」按鈕

## 非範圍

- LINE Bot 本身不受影響（Webhook 端點無需認證）
- 不做多用戶/角色管理（僅白名單單一使用者）
- 不做即時推播通知或預算警示（留作未來迭代）
