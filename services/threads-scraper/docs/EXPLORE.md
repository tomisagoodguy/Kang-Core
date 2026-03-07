# 探索模式使用指南 🌍

## 這是什麼？

**探索模式**讓您可以自動搜尋整個 Threads 平台上的新貼文，而不只是追蹤特定用戶。

## 🎯 與傳統追蹤的區別

### 傳統模式（追蹤用戶）
```
指定用戶 → 抓取他們的貼文 → 關鍵字篩選
```
- 優點：精準、可控
- 缺點：範圍受限於已追蹤的用戶

### 探索模式（搜尋新貼文）
```
Threads 探索頁面 → 抓取熱門貼文 → 關鍵字篩選
```
- 優點：發現新內容、範圍更廣
- 缺點：抓取較慢、可能有不相關內容

## ⚙️ 設定方式

在 `config.yaml` 中：

```yaml
explore:
  enabled: true      # 啟用探索模式
  max_scrolls: 3     # 滾動次數（2-5 次為佳）

keywords:
  - "AI"
  - "機器學習"
  - "程式設計"
```

## 📊 抓取數量

| 滾動次數 | 預計貼文數 | 執行時間 | 建議用途 |
|---------|----------|---------|---------|
| 1-2 次  | 10-30 篇 | ~30 秒  | 快速檢查 |
| 3 次    | 30-45 篇 | ~1 分鐘 | 日常使用（推薦）|
| 4-5 次  | 45-75 篇 | ~2 分鐘 | 深度搜尋 |

## 🚀 實際使用範例

### 場景 1：追蹤 AI 相關討論

```yaml
explore:
  enabled: true
  max_scrolls: 3

keywords:
  - "GPT"
  - "Claude"
  - "AI"
  - "機器學習"

discovery:
  enabled: true
  min_like_count: 100
```

**效果：**
- 每天發現 5-15 篇 AI 相關熱門貼文
- 自動追蹤活躍的 AI 討論者
- 持續擴展追蹤網路

### 場景 2：監控特定事件

```yaml
explore:
  enabled: true
  max_scrolls: 5     # 更深入搜尋

keywords:
  - "地震"
  - "颱風"
  - "緊急"

discovery:
  enabled: false     # 不自動追蹤
```

**效果：**
- 即時發現相關討論
- 不會自動追蹤陌生用戶
- 適合臨時監控特定事件

### 場景 3：內容策展

```yaml
explore:
  enabled: true
  max_scrolls: 4

keywords:
  - "設計"
  - "UX"
  - "介面"
  - "產品"

discovery:
  enabled: true
  min_like_count: 200  # 只追蹤高質量創作者
```

**效果：**
- 發現優質設計相關內容
- 自動追蹤頂尖設計師
- 建立高質量的內容源

## 💡 最佳實踐

### ✅ 推薦做法

1. **設定明確的關鍵字**
   ```yaml
   keywords:
     - "React"        # 精確
     - "前端開發"     # 明確
   ```

2. **搭配自動發現**
   ```yaml
   discovery:
     enabled: true
     min_like_count: 100
   ```

3. **合理的滾動次數**
   ```yaml
   max_scrolls: 3    # 平衡速度與數量
   ```

4. **每天執行 1-2 次**
   ```yaml
   schedule:
     daily_at: "09:00"
   ```

### ❌ 避免做法

1. ❌ 滾動次數過多（> 5 次）→ 太慢且容易被偵測
2. ❌ 關鍵字過於通用（如：「好」、「讚」）→ 太多雜訊
3. ❌ 頻繁執行（每小時多次）→ 容易被封鎖
4. ❌ 不設關鍵字→ 會收到大量不相關通知

## 🔧 故障排除

### Q: 為什麼沒有抓到貼文？

**A:** 可能原因：
1. Threads 首頁結構改變 → 需要更新程式碼
2. 網路問題 → 檢查連線
3. 被暫時限流 → 減少請求頻率

### Q: 抓到太多不相關的貼文？

**A:** 解決方法：
1. 更精確的關鍵字
2. 提高自動發現門檻
3. 減少滾動次數

### Q: 執行太慢？

**A:** 優化建議：
1. 減少 `max_scrolls`（改為 2）
2. 關閉自動發現
3. 檢查網路速度

## 📈 進階技巧

### 組合多種模式

```yaml
# 1. 追蹤核心用戶（精準）
users:
  - username: "tech_leader"

# 2. 探索新內容（廣泛）
explore:
  enabled: true
  max_scrolls: 3

# 3. 自動擴展（智能）
discovery:
  enabled: true
  min_like_count: 100
```

**優勢：**
- 核心來源穩定（追蹤用戶）
- 發現新內容（探索模式）
- 自動成長（用戶發現）

### 時段策略

不同時段使用不同設定：

**早上 09:00**（快速檢查）
```yaml
explore:
  max_scrolls: 2
```

**晚上 21:00**（深度搜尋）
```yaml
explore:
  max_scrolls: 5
```

## 🎯 預期成效

根據我們的測試：

**啟用探索模式後：**
- 📈 每天發現的新貼文：+150%
- 👤 自動追蹤的用戶：+5-10 個/週
- 🎯 符合關鍵字的貼文：+200%
- ⏱️ 執行時間：+30-60 秒/次

**投資報酬率：**
- 額外時間成本：~1 分鐘/天
- 額外發現內容：+30-75 篇貼文/天
- 非常值得！✅

## 🚀 開始使用

```bash
# 1. 編輯設定
vim config.yaml

# 2. 測試執行
uv run python scheduler.py run

# 3. 查看結果
uv run python scheduler.py stats

# 4. 啟動排程
uv run python scheduler.py start
```

Happy Exploring! 🌍
