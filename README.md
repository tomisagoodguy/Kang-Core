# Kang-Core - 個人智慧助理與知識/財務管理系統

## 🌟 核心目標 (Core Objective)

建立一個以 LINE Bot 為單一且極簡的輸入入口，結合 AI (Gemini API) 自動解析與分類非結構化資料，並透過 Next.js 儀表板進行視覺化管理、財務統計與知識收斂的個人智慧助理生態系。

解決痛點：消除繁瑣的記帳格式與書籤分類流程，讓使用者用最直覺的自然語言或直接貼上網址/圖片，交由 AI 自動結構化存檔，實現「**隨手丟、自動整、隨時查**」。

## 🏗 系統架構 (Architecture)

採用 **Next.js Fullstack (App Router)** 單一專案結構，統一前後端語言 (TypeScript) 與型別，降低部署與維護成本。

* **輸入端**: LINE Bot (自然語言、網址、圖片、公文)
* **解析核心**: Google AI Studio (Gemini 1.5 Flash/Pro) - 負責 NLU 意圖判斷、結構化資料抽取 (Structured Outputs)、自動生成標籤。
* **資料庫與儲存 (Firebase Ecosystem)**:
  * **Firestore**: 儲存結構化資料 (`accounting`, `archives`)
  * **Storage**: 儲存圖片、公文等實體檔案
  * **Auth**: 儀表板登入權限控管 (僅限管理者)
* **展示與管理 (Dashboard)**: Next.js + Tailwind CSS + Zustand (財務圖表視覺化、待看/知識清單 Kanban 管理)
* **自動化 (未來規劃)**: GCP Cloud Scheduler 定期觸發統計，並經由 LINE 主動推播提醒。

## 🔄 核心資料工作流 (Data Workflows)

### 1. 財務記帳 (Accounting Workflow)

* **情境**: 傳送「晚餐 150，在樓下買便當」
* **處理**: AI 解析判斷 `intent: accounting`，自動提取。
* **儲存**: 寫入 Firestore `accounting` 集合。
* **應用**: 後台儀表板產生每月收支圖表、分類圓餅圖。

### 2. 稍後閱讀與知識庫 (Archives - URL/Notes Workflow)

* **情境**: 傳送一篇技術文章或娛樂影片的網址。
* **處理**:
  1. 抓取網頁 Meta (Title, Description, og:image)。
  2. AI 根據抓到的標題與描述，自動進行分類與打標籤 (e.g., `["技術", "Next.js", "教學"]` 或 `["娛樂", "YouTube"]`)。
* **儲存**: 寫入 Firestore `archives` 集合，將狀態標示為 `unread` (未讀)。
* **應用**: 後台進入「待看清單」板塊，讀完後可點擊標記為已讀/歸檔。

### 3. 圖片與公文庫 (Archives - Media Workflow)

* **情境**: 上傳水電費帳單照片、截圖或圖檔。
* **處理**: 檔案存入 Firebase Storage 取得永久連結。可額外結合 AI Vision 萃取圖片文字摘要。
* **儲存**: 寫入 Firestore `archives` 集合，綁定 Storage 連結。
* **應用**: 日後可透過關鍵字或標籤迅速搜尋調閱歷史影像。

## 💾 資料模型 (Data Schema Blueprint)

### Accounting (財務記帳)

```typescript
interface AccountingEntry {
  id: string;
  amount: number;             // 金額
  type: 'expense' | 'income'; // 支出或收入
  category: string;           // 系統大分類 (供前端圓餅圖統計)
  description: string;        // 消費明細/描述
  tags: string[];             // AI 判斷的附加標籤 (e.g. ['午餐', '便利商店'])
  rawText: string;            // 原始 LINE 訊息
  createdAt: Timestamp;       // 記錄時間
}
```

### Archive (知識庫與檔案)

```typescript
interface ArchiveEntry {
  id: string;
  type: 'link' | 'note' | 'document' | 'image';
  status: 'unread' | 'reading' | 'archived'; // 狀態 (適用於稍後閱讀)
  title: string;          // 解析出的標題或 AI 總結摘要
  content: string;        // 網址本人, 筆記內文, 或是 Storage 下載連結
  metadata: {
    previewImageUrl: string | null;  // 網址預覽圖 OG:Image
    description: string | null;      // 網頁 Description
    tags: string[];                  // AI 生成的關聯標籤
  };
  rawText: string;        // 原始 LINE 訊息
  createdAt: Timestamp;   // 記錄時間
}
```

## 🛠 技術堆疊 (Tech Stack)

* **Core**: Next.js (App Router), TypeScript, Node.js
* **Package Manager**: `yarn`
* **AI Integration**: `@google/generative-ai` (Gemini)
* **Messaging**: `@line/bot-sdk`
* **BaaS**: `firebase` (Firestore, Storage, Auth)
* **Styling**: Tailwind CSS
* **State Management**: `zustand`
* **Validation**: `zod`


關注中:
https://www.evanlin.com/

https://github.com/kkdai/linebot-file

https://www.ccclub.io/achievement
