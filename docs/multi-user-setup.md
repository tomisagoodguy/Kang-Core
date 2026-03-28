# Multi-User 設定指南

多用戶支援已實作完成。本文件說明如何新增第二位用戶（例如媽媽）。

---

## 新增環境變數

在 **Vercel Dashboard → Settings → Environment Variables** 新增以下兩個變數，本地 `.env.local` 同步新增：

### `LINE_USER_IDS`

所有用戶的 LINE User ID，逗號分隔。

```env
LINE_USER_IDS=Uxxxxxxxxxx,Uxxxxxxxxxx
```

> 向後相容：若只設定 `LINE_USER_ID`（舊變數），系統會自動 fallback，不影響現有功能。

### `EMAIL_LINE_MAP`

Google 帳號 email 對應 LINE User ID，供 Dashboard 登入識別用。格式：`email:lineUserId`，逗號分隔。

```env
EMAIL_LINE_MAP=admin@gmail.com:Uxxxxxxxxxx,mom@gmail.com:Uxxxxxxxxxx
```

---

## 取得媽媽的 LINE User ID

1. 媽媽掃 QR Code 加 Bot 好友
2. 媽媽傳送任意訊息給 Bot
3. 前往 **Vercel Dashboard → Deployments → Functions Logs**
4. 找到 `/api/webhook` 的 log，其中會有 `userId: Uxxxxxxxxxx`

---

## 設定 .env.local（本地開發）

`.env.local` 已在 `.gitignore`，安全新增即可：

```bash
# 在 .env.local 末尾加入
LINE_USER_IDS="你的LINE_USER_ID,媽媽的LINE_USER_ID"
EMAIL_LINE_MAP="你的gmail@gmail.com:你的LINE_USER_ID,媽媽的gmail@gmail.com:媽媽的LINE_USER_ID"
```

---

## Firestore 複合索引

加上 `userId` 過濾後，首次部署若 Vercel Logs 出現 `FAILED_PRECONDITION` 錯誤，點 Firebase 提供的連結自動建立複合索引即可。

可能需要建立的索引：

| Collection             | 索引欄位                        |
| ---------------------- | ------------------------------- |
| `accounting`           | `userId ASC` + `createdAt DESC` |
| `accounting`           | `userId ASC` + `date ASC`       |
| `calendar`             | `userId ASC` + `actionDate ASC` |
| `calendar`             | `userId ASC` + `status ASC`     |
| `recurring_expenses`   | `userId ASC` + `isActive ASC`   |
| `classification_rules` | `userId ASC` + `lastUsed DESC`  |

---

## 驗證清單

部署完成後逐項確認：

- [ ] 媽媽傳訊息給 Bot → Firestore `accounting` 中有她自己的 `userId`
- [ ] 你的 Dashboard 只顯示你的記帳資料
- [ ] 媽媽的 Dashboard 只顯示她的資料（初始為空）
- [ ] 21:00 Cron — 兩人各自收到每日摘要
- [ ] 00:05 Cron — 媽媽的定期支出正確入帳（若有設定）
- [ ] 每月 1 日月報 — 兩人各自收到各自的帳目分析
- [ ] Threads 摘要 — 兩人都收到

---

## Cron 推播政策

| Cron            | 台灣時間      | 推播對象                    |
| --------------- | ------------- | --------------------------- |
| daily-summary   | 21:00         | 所有用戶（各自資料）        |
| calendar-remind | 08:00         | 所有用戶（各自行事曆）      |
| monthly-report  | 每月1日 09:00 | 所有用戶（各自帳目）        |
| recurring       | 00:05         | 所有用戶（各自定期支出）    |
| diary-prompt    | 22:30         | 所有用戶                    |
| threads-summary | 20:00         | 所有用戶（全域內容）        |
| monthly-sheet   | 每月底 23:00  | 管理員專屬（Google Sheets） |
