# Proposal: 安全強化 + 生活功能擴充

## 背景

稽核報告（2026-03-01）發現以下問題：

- Webhook 缺少簽章驗證，任何人可偽造 LINE 事件
- Middleware Cookie 驗證為形式性，無法阻擋偽造 Session
- 洞察功能 userId 硬編碼，多用戶場景下有資料洩漏風險
- 多項技術債（重複 tagEmoji、/記 不觸發學習、processed_messages 不清理）

## 目標

1. **修復 P0 安全漏洞**：Webhook 簽章驗證、ClassificationEngine 輸入清理
2. **修復 P1 安全漏洞**：洞察 userId 隔離、processed_messages TTL 清理
3. **修復技術債**：統一 tagEmoji、/記 觸發學習
4. **新功能 1**：預算超支警報（月預算設定 + 超 80% push 提醒）
5. **新功能 2**：Archive RAG 問答（`/問 <問題>`）
6. **新功能 3**：待辦完成指令（`/完成 <關鍵字>`）
7. **新功能 4**：晚間日記模式（cron 22:30 問一句）
8. **新功能 5**：月底 Export Google Sheets（cron 月底 trigger）
9. **新功能 6**：LINE Rich Menu（底部 6 格快捷按鈕）

## 不在範圍內

- 更換 AI 模型或底層架構
- Web Dashboard 重大 UI 改版
- 多租戶架構（仍維持單人使用設計）
