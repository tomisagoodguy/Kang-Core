# 建議追蹤的 Threads 帳號

這份清單整理了 AI、科技、軟體開發領域的優質 Threads 帳號。

## 🤖 AI / Machine Learning

### 英文
- `@zuck` - Mark Zuckerberg (Meta CEO, 5.4M followers)
- `@aiatmeta` - Meta AI 官方帳號
- `@ai.news.daily` - AI 新聞與科技更新
- `@power.ai` - AI 工具與教學 (800K+ followers)
- `@sama` - Sam Altman (OpenAI CEO) *需確認*
- `@emollick` - Ethan Mollick (AI 教育研究者)
- `@drjimfan` - Jim Fan (NVIDIA AI 研究員)
- `@hardmaru` - David Ha (Stability AI)

### 繁體中文
- `@fox.hsiao` - Fox Hsiao (INSIDE 創辦人、AI/區塊鏈/科技)
- `@sa_taiwan` - 科學人 (台灣)
- `@bnextmedia` - 數位時代 *需確認*
- `@inside_tw` - INSIDE 硬塞的網路趨勢觀察 *需確認*

## 💻 科技媒體與新聞

### 英文
- `@verge` - The Verge (632.5K followers)
- `@sokane1` - Sarah Perez (TechCrunch 資深記者)
- `@techcrunch` - TechCrunch 官方 *需確認*
- `@wired` - WIRED 雜誌 *需確認*
- `@engadget` - Engadget *需確認*

### 繁體中文
- `@technews.tw` - 科技新報 *需確認*
- `@cool3c` - 癮科技 *需確認*

## 👨‍💻 軟體開發與工程

### 英文
- `@dan_abramov` - Dan Abramov (React 核心團隊)
- `@kentcdodds` - Kent C. Dodds (React/Testing 教學)
- `@swyx` - Shawn Wang (開發者關係專家)
- `@shadcn` - shadcn (UI 設計師/開發者)
- `@t3dotgg` - Theo Browne (Web 開發 YouTuber)
- `@levelsio` - Pieter Levels (獨立開發者)
- `@dhh` - DHH (Ruby on Rails 創辦人)

## 🚀 產品與新創

### 英文
- `@lenny` - Lenny Rachitsky (產品成長專家)
- `@shreyas` - Shreyas Doshi (前 Google/Stripe PM)
- `@joulee` - Julie Zhuo (前 Facebook VP)

## 🔧 開發工具與平台

- `@vercel` - Vercel 官方
- `@github` - GitHub 官方 *需確認*
- `@supabase` - Supabase 官方 *需確認*
- `@railway` - Railway 官方 *需確認*

## 📊 如何使用這份清單

### 手動新增到 config.yaml
```yaml
users:
  - username: "levelsio"
    max_posts: 10
```

### 批次測試帳號活躍度
```bash
# 使用 Python 腳本測試這些帳號是否存在且活躍
uv run python scripts/verify_accounts.py
```

### 自動發現機制
你的系統已經會自動發現：
1. 從熱門貼文中發現作者（> 50 讚）
2. 從回覆中發現活躍用戶
3. 定期清理不活躍帳號（60 天）

## 💡 尋找更多帳號的方法

1. **從現有用戶的 Following 找**
   - 查看 @fox.hsiao、@zuck 追蹤誰

2. **從熱門貼文的互動找**
   - 看誰經常回覆你追蹤的用戶

3. **從 Twitter 對照**
   - 很多 Twitter 帳號會在 Threads 使用同名

4. **搜尋特定主題**
   - 在 Threads 搜尋 #AI、#WebDev 等標籤

## ⚠️ 注意事項

帶有 *需確認* 標記的帳號：
- 可能不存在或用戶名不同
- 需要手動在 Threads 搜尋確認
- 建議先測試再加入 config.yaml

---

**更新日期**: 2026-02-26
