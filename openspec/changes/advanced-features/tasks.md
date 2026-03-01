# Tasks: 進階功能九連發

## Batch A — 高優先

### A1: 定期/固定支出

- [x] 1. 建立 `recurring_expenses` Firestore 集合結構
- [x] 2. 建立 `/api/recurring` CRUD 端點（GET / POST）
- [x] 3. 建立 `/api/recurring/[id]` 端點（PUT / DELETE）
- [x] 4. 建立 `/api/cron/recurring` — Cron Job 自動觸發入帳
- [x] 5. 建立 `/recurring` 前端頁面 — 列表 + 新增/編輯 Modal + 啟停 Toggle
- [x] 6. Navbar 新增「定期支出」入口
- [x] 7. 設定 `vercel.json` crons

### A2: LINE 主動推播

- [x] 8. 取得 LINE User ID 並存入 `.env.local` 的 `LINE_USER_ID`
- [x] 9. 建立 `/api/cron/daily-summary` — 每日消費摘要推播
- [x] 10. 建立 `/api/cron/calendar-remind` — 每日行事曆提醒推播
- [x] 11. 建立 `/api/cron/monthly-report` — 月報推播
- [x] 12. 設計 LINE 推播訊息模板（消費摘要、行事曆、月報）
- [x] 13. 設定 `CRON_SECRET` 環境變數 + 認證中間件
- [x] 14. 更新 `vercel.json` crons

### A3: 對話式查詢

- [x] 15. 擴充 Gemini System Prompt — 新增 `query` 意圖類型
- [x] 16. 建立 `src/services/queryEngine.ts` — 查詢引擎
- [x] 17. 修改 `src/services/message.service.ts` — 串接查詢流程
- [x] 18. 實作日期範圍解析（本月/上月/本週/上週/今天/明天）
- [x] 19. 格式化查詢回覆（消費統計/存檔列表/行事曆清單）

---

## Batch B — 中優先

### B4: 自訂標籤 / 子分類

- [x] 20. 建立 `custom_tags` Firestore 集合結構
- [x] 21. 建立 `/api/tags` CRUD 端點
- [x] 22. 建立 `/settings/tags` 管理頁面
- [x] 23. 修改記帳頁 filter — 兩層選單（主分類 → 子分類）
- [x] 24. `accounting` 集合新增 `subTag` 可選欄位
- [x] 25. 修改 Gemini Prompt — 嘗試匹配自訂子標籤
- [ ] 26. 修改圓餅圖 — 支援展開子標籤 (保留到 C7/C9 再優化)

### B5: PWA

- [x] 27. 建立 `public/manifest.json`
- [ ] 28. 建立 `public/sw.js` — Service Worker (暫緩，先以 Manifest 為主)
- [x] 29. 生成 PWA Icon (512x512)
- [x] 30. 修改 `layout.tsx` — 加入 manifest link + meta tags + viewport
- [ ] 31. 建立 `sw-register.ts` — (暫緩)
- [ ] 32. 離線 fallback 頁面（可選）

### B6: 深色/淺色切換

- [x] 33. 重構 `globals.css` — 拆分 `[data-theme="dark"]` 和 `[data-theme="light"]` 變數
- [x] 34. 建立 `src/components/ThemeToggle.tsx`
- [x] 35. 修改 Navbar — 加入 toggle 按鈕
- [x] 36. 建立 `ThemeProvider.tsx` 並整合到 `layout.tsx`
- [x] 37. 測試所有頁面在淺色模式下的視覺效果

---

## Batch C — 進階

### C7: AI 消費洞察

- [x] 38. 建立 `/api/insights` 端點 — Gemini 分析消費資料
- [x] 39. 建立 `insights` Firestore 集合（快取結果）
- [x] 40. 建立 `src/components/InsightCard.tsx`
- [x] 41. 整合到記帳頁（圖表區下方）
- [x] 42. 整合到月報推播（A2 的 monthly-report 底部）
- [x] 43. LINE `/洞察` 指令支援

### C8: 快速記帳指令

- [x] 44. 建立 `src/services/quickCommand.ts` — 指令解析器
- [x] 45. 實作 `/記` 指令 — 快速記帳
- [x] 46. 實作 `/查` 指令 — 快速查詢
- [x] 47. 實作 `/待` 指令 — 快速建立待辦
- [x] 48. 實作 `/help` 指令 — 指令說明
- [x] 49. 修改 `message.service.ts` — 最前端攔截快速指令

### C9: 收據自動分類規則

- [x] 50. 建立 `classification_rules` Firestore 集合
- [x] 51. 建立規則匹配引擎 `src/services/classificationEngine.ts`
- [x] 52. 修改記帳流程 — 先查規則再決定是否走 Gemini
- [x] 53. 記帳完成後自動建立/更新規則
- [ ] 54. 使用者修改 tag 時同步更新規則
- [ ] 55. 建立 `/api/rules` CRUD 端點
- [ ] 56. 建立 `/settings/rules` 管理頁面
- [ ] 57. 低 confidence 規則高亮提示

### C10: AI 配額優化與重試機制 (Limit-Proofing)

- [x] 58. 建立 `src/lib/gemini/client.ts` — 實作指數退避重試 (429)
- [x] 59. 整合 `safeExecute` 到 `parser.ts` 與 `vision.ts`
- [x] 60. 實作 `insights.ts` 雲端持久性快取 — 1 小時內不重複調用
- [x] 61. 擴充 `GEMMA_MODELS` 備援清單 — 使用 14,400 RPD 高配額模型
- [x] 62. 在 LINE 中顯示具體的 Limit 錯誤提示

---

## 驗收

- [x] 58. 全部 `yarn build` 通過
- [x] 59. 全部推送 GitHub
- [x] 60. Vercel 環境變數 + Cron 設定完成 (Gemini, LINE)
