# Tasks: 儀表板強化

## Phase 1: 認證保護

- [ ] 1. 安裝 `firebase` 客戶端 SDK（`yarn add firebase`）
- [ ] 2. 建立 `src/lib/firebase/auth.ts`：初始化 Firebase Auth、Google Sign-in、Sign-out
- [ ] 3. 建立 `src/components/AuthProvider.tsx`：React Context，監聽 Auth 狀態，管理 Session Cookie
- [ ] 4. 建立 `src/app/api/auth/session/route.ts`：POST 設定 Session Cookie / DELETE 清除
- [ ] 5. 建立 `src/middleware.ts`：攔截頁面路由，檢查 Session，無效則導向 `/login`
- [ ] 6. 建立 `src/app/login/page.tsx`：Google Sign-in 登入頁面
- [ ] 7. 修改 `src/app/layout.tsx`：包裝 `<AuthProvider>`
- [ ] 8. 在 `.env.local` 加入 `AUTHORIZED_EMAILS` 環境變數

## Phase 2: 資料編輯與刪除

- [ ] 9. 擴充 `src/app/api/accounting/[id]/route.ts`：新增 PUT 和 DELETE
- [ ] 10. 擴充 `src/app/api/archive/[id]/route.ts`：新增 PUT 和 DELETE
- [ ] 11. 修改 `src/app/api/calendar/[id]/route.ts`：增強 DELETE（同步刪除 Google Calendar）、新增 PUT
- [ ] 12. 建立 `src/components/EditModal.tsx`：通用編輯 Modal
- [ ] 13. 建立 `src/components/DeleteConfirm.tsx`：通用確認刪除 Dialog
- [ ] 14. 改造 `AccountingCard.tsx`、`ArchiveCard.tsx`、`CalendarCard.tsx`：加入編輯/刪除按鈕

## Phase 3: 記帳趨勢圖表

- [ ] 15. 安裝 `recharts`（`yarn add recharts`）
- [ ] 16. 建立 `src/components/charts/MonthlyTrendChart.tsx`：月度折線圖
- [ ] 17. 建立 `src/components/charts/TagPieChart.tsx`：標籤圓餅圖
- [ ] 18. 修改 `src/app/accounting/page.tsx`：整合圖表 + 資料聚合邏輯

## Phase 4: 資料匯出

- [ ] 19. 建立 `src/app/api/export/accounting/route.ts`：CSV 匯出 API
- [ ] 20. 修改 `src/app/accounting/page.tsx`：新增「匯出 CSV」按鈕

## 驗收

- [ ] 21. `yarn build` 編譯通過，`yarn lint` 無新增錯誤
- [ ] 22. 推送 GitHub
