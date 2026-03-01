# Tasks: 進階功能九連發

## Batch A — 高優先

### A1: 定期/固定支出

- [ ] 1. 建立 `recurring_expenses` Firestore 集合結構
- [ ] 2. 建立 `/api/recurring` CRUD 端點（GET / POST）
- [ ] 3. 建立 `/api/recurring/[id]` 端點（PUT / DELETE）
- [ ] 4. 建立 `/api/cron/recurring` — Cron Job 自動觸發入帳
- [ ] 5. 建立 `/recurring` 前端頁面 — 列表 + 新增/編輯 Modal + 啟停 Toggle
- [ ] 6. Navbar 新增「定期支出」入口
- [ ] 7. 設定 `vercel.json` crons

### A2: LINE 主動推播

- [ ] 8. 取得 LINE User ID 並存入 `.env.local` 的 `LINE_USER_ID`
- [ ] 9. 建立 `/api/cron/daily-summary` — 每日消費摘要推播
- [ ] 10. 建立 `/api/cron/calendar-remind` — 每日行事曆提醒推播
- [ ] 11. 建立 `/api/cron/monthly-report` — 月報推播
- [ ] 12. 設計 LINE Flex Message 模板（消費摘要、行事曆、月報）
- [ ] 13. 設定 `CRON_SECRET` 環境變數 + 認證中間件
- [ ] 14. 更新 `vercel.json` crons

### A3: 對話式查詢

- [ ] 15. 擴充 Gemini System Prompt — 新增 `query` 意圖類型
- [ ] 16. 建立 `src/services/queryEngine.ts` — 查詢引擎
- [ ] 17. 修改 `src/services/lineBotService.ts` — 串接查詢流程
- [ ] 18. 實作日期範圍解析（本月/上月/本週/上週/今天/明天）
- [ ] 19. 格式化查詢回覆（消費統計/存檔列表/行事曆清單）

---

## Batch B — 中優先

### B4: 自訂標籤 / 子分類

- [ ] 20. 建立 `custom_tags` Firestore 集合結構
- [ ] 21. 建立 `/api/tags` CRUD 端點
- [ ] 22. 建立 `/settings/tags` 管理頁面
- [ ] 23. 修改記帳頁 filter — 兩層選單（主分類 → 子分類）
- [ ] 24. `accounting` 集合新增 `subTag` 可選欄位
- [ ] 25. 修改 Gemini Prompt — 嘗試匹配自訂子標籤
- [ ] 26. 修改圓餅圖 — 支援展開子標籤

### B5: PWA

- [ ] 27. 建立 `public/manifest.json`
- [ ] 28. 建立 `public/sw.js` — Service Worker (network-first)
- [ ] 29. 生成 PWA Icon（192x192 + 512x512）
- [ ] 30. 修改 `layout.tsx` — 加入 manifest link + meta tags
- [ ] 31. 建立 `sw-register.ts` — SW 註冊邏輯
- [ ] 32. 離線 fallback 頁面（可選）

### B6: 深色/淺色切換

- [ ] 33. 重構 `globals.css` — 拆分 `[data-theme="dark"]` 和 `[data-theme="light"]` 變數
- [ ] 34. 建立 `src/components/ThemeToggle.tsx`
- [ ] 35. 修改 Navbar — 加入 toggle 按鈕
- [ ] 36. 加入防閃爍 blocking script（layout.tsx head）
- [ ] 37. 測試所有頁面在淺色模式下的視覺效果

---

## Batch C — 進階

### C7: AI 消費洞察

- [ ] 38. 建立 `/api/insights` 端點 — Gemini 分析消費資料
- [ ] 39. 建立 `insights` Firestore 集合（快取結果）
- [ ] 40. 建立 `src/components/InsightCard.tsx`
- [ ] 41. 整合到記帳頁（圖表區下方）
- [ ] 42. 整合到月報推播（A2 的 monthly-report 底部）
- [ ] 43. LINE `/洞察` 指令支援

### C8: 快速記帳指令

- [ ] 44. 建立 `src/services/quickCommand.ts` — 指令解析器
- [ ] 45. 實作 `/記` 指令 — 快速記帳
- [ ] 46. 實作 `/查` 指令 — 快速查詢
- [ ] 47. 實作 `/待` 指令 — 快速建立待辦
- [ ] 48. 實作 `/help` 指令 — 指令說明
- [ ] 49. 修改 `lineBotService.ts` — 最前端攔截快速指令

### C9: 收據自動分類規則

- [ ] 50. 建立 `classification_rules` Firestore 集合
- [ ] 51. 建立規則匹配引擎 `src/services/classificationEngine.ts`
- [ ] 52. 修改記帳流程 — 先查規則再決定是否走 Gemini
- [ ] 53. 記帳完成後自動建立/更新規則
- [ ] 54. 使用者修改 tag 時同步更新規則
- [ ] 55. 建立 `/api/rules` CRUD 端點
- [ ] 56. 建立 `/settings/rules` 管理頁面
- [ ] 57. 低 confidence 規則高亮提示

---

## 驗收

- [ ] 58. 全部 `yarn build` 通過
- [ ] 59. 全部推送 GitHub
- [ ] 60. Vercel 環境變數 + Cron 設定完成
