# Multi-User Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 讓第二位用戶（媽媽）可以完整使用 LINE Bot 記帳功能，並有獨立的 Web Dashboard，Cron 通知分別推送給每位用戶。

**Architecture:** 以環境變數 `LINE_USER_IDS`（逗號分隔）管理所有用戶 LINE ID，以 `EMAIL_LINE_MAP`（`email:lineUserId` 格式）對應 Google 帳號登入到各自的 LINE userId。新增一個共用 helper (`userRegistry.ts`) 讀取這兩個設定，新增 `getSessionUserId()` 供 Dashboard API routes 使用。所有 Firestore 查詢補上 `userId` 過濾，Cron Jobs 改為迭代所有用戶。

**Tech Stack:** Next.js 16 App Router, Firebase Admin SDK, TypeScript, `@line/bot-sdk`, Vercel Cron

---

## 背景知識

### 資料架構

- 每筆 Firestore 文件都有 `userId`（LINE user ID，格式 `Uxxxxxxxxxx`）
- Dashboard 目前未過濾 userId，等於所有人看到彼此的資料（安全漏洞）
- LINE Bot 端本就以 `userId` 隔離，是安全的

### 現存問題總覽

| 問題                                        | 嚴重度      | 位置                 |
| ------------------------------------------- | ----------- | -------------------- |
| Dashboard API 無 userId 過濾                | 🔴 資料洩漏 | 6 個 routes          |
| `budget/route.ts` hardcode `LINE_USER_ID`   | 🔴 功能錯誤 | budget/route.ts:13   |
| `insights/route.ts` hardcode "default_user" | 🟡 功能錯誤 | insights/route.ts:19 |
| Cron 查詢無 userId 過濾                     | 🟡 資料混雜 | 5 個 cron routes     |
| Cron 只推給單一用戶                         | 🟡 功能缺失 | 7 個 cron routes     |

### 環境變數設計

```
# 現有（保留）
LINE_USER_ID="Uxxx"              # 管理員（你）的 LINE ID

# 新增
LINE_USER_IDS="Uxxx,Uyyy"       # 所有用戶（含管理員），Cron 用
EMAIL_LINE_MAP="admin@gmail.com:Uxxx,mom@gmail.com:Uyyy"  # Dashboard 登入對應
```

### 各 Cron 的多用戶政策

| Cron            | 政策                                   |
| --------------- | -------------------------------------- |
| daily-summary   | 推給所有用戶（各自的資料）             |
| calendar-remind | 推給所有用戶（各自的行事曆）           |
| monthly-report  | 推給所有用戶（各自的帳目）             |
| monthly-sheet   | 只推給管理員（Google Sheets 是個人的） |
| recurring       | 各用戶各自的定期支出；通知推給各人     |
| diary-prompt    | 推給所有用戶                           |
| threads-summary | 只推給管理員（Threads 追蹤是個人的）   |

---

## Task 1: 建立 userRegistry helper

**Files:**

- Create: `src/lib/userRegistry.ts`

### Step 1: 建立 helper 檔案

```typescript
// src/lib/userRegistry.ts

/**
 * 讀取所有已註冊的 LINE user IDs（供 Cron Jobs 迭代）
 * 環境變數 LINE_USER_IDS: 逗號分隔，例如 "Uxxx,Uyyy"
 * 若未設定則 fallback 到 LINE_USER_ID（維持向後相容）
 */
export function getAllLineUserIds(): string[] {
  const multi = process.env.LINE_USER_IDS || "";
  const single = process.env.LINE_USER_ID || "";
  const raw = multi || single;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 透過 Google 帳號 email 取得對應的 LINE userId（供 Dashboard API 用）
 * 環境變數 EMAIL_LINE_MAP: 逗號分隔 "email:lineUserId" pairs
 * 例如 "admin@gmail.com:Uxxx,mom@gmail.com:Uyyy"
 */
export function getLineUserIdFromEmail(email: string): string | null {
  const raw = process.env.EMAIL_LINE_MAP || "";
  if (!raw) return null;
  const pairs = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const pair of pairs) {
    const colonIdx = pair.indexOf(":");
    if (colonIdx === -1) continue;
    const e = pair.slice(0, colonIdx).trim().toLowerCase();
    const id = pair.slice(colonIdx + 1).trim();
    if (e === email.toLowerCase()) return id;
  }
  return null;
}
```

### Step 2: Commit

```bash
git add src/lib/userRegistry.ts
git commit -m "feat(auth): 新增 userRegistry helper，支援多用戶 LINE ID 管理"
```

---

## Task 2: 建立 getSessionUserId helper

Dashboard API routes 需要知道「目前登入的 Google 帳號」對應哪個 LINE userId。

**Files:**

- Create: `src/lib/auth/getSessionUserId.ts`

### Step 1: 建立 helper 檔案

```typescript
// src/lib/auth/getSessionUserId.ts
import { admin } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getLineUserIdFromEmail } from "@/lib/userRegistry";

const COOKIE_NAME = "firebase-session";

/**
 * 從 HTTP Request 的 Session Cookie 解析當前用戶的 LINE userId
 * 回傳 null 表示未登入或 email 未在 EMAIL_LINE_MAP 中設定
 */
export async function getSessionUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;
    if (!sessionCookie) return null;

    const decoded = await admin.auth().verifySessionCookie(sessionCookie, true);
    const email = decoded.email?.toLowerCase();
    if (!email) return null;

    return getLineUserIdFromEmail(email);
  } catch {
    return null;
  }
}
```

### Step 2: Commit

```bash
git add src/lib/auth/getSessionUserId.ts
git commit -m "feat(auth): 新增 getSessionUserId，從 session cookie 解析 LINE userId"
```

---

## Task 3: 修復 budget/route.ts（hardcode userId Bug）

**Files:**

- Modify: `src/app/api/budget/route.ts`

### Step 1: 修改 GET handler

將 `const USER_ID = process.env.LINE_USER_ID ?? "default_user";` 刪除，改為在每個 handler 中呼叫 `getSessionUserId()`。

```typescript
// src/app/api/budget/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const snap = await db
      .collection("budgets")
      .where("userId", "==", userId)
      .get();
    const budgets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ budgets });
  } catch (err) {
    console.error("[budget] GET error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { tag?: string; monthlyLimit: number };
    const { tag, monthlyLimit } = body;
    if (!monthlyLimit || monthlyLimit <= 0) {
      return NextResponse.json(
        { error: "monthlyLimit 必須大於 0" },
        { status: 400 },
      );
    }
    let query = db
      .collection("budgets")
      .where("userId", "==", userId) as FirebaseFirestore.Query;
    if (tag) {
      query = query.where("tag", "==", tag);
    } else {
      query = query.where("tag", "==", null);
    }
    const existing = await query.get();
    if (!existing.empty) {
      await existing.docs[0].ref.update({
        monthlyLimit,
        updatedAt: new Date(),
      });
    } else {
      await db.collection("budgets").add({
        userId,
        tag: tag ?? null,
        monthlyLimit,
        createdAt: new Date(),
      });
    }
    const tagLabel = tag ? `「${tag}」` : "總";
    return NextResponse.json({
      message: `${tagLabel}預算已設定為 $${monthlyLimit}`,
    });
  } catch (err) {
    console.error("[budget] POST error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "缺少 id 參數" }, { status: 400 });
    }
    // 驗證此 budget 屬於當前用戶
    const doc = await db.collection("budgets").doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await db.collection("budgets").doc(id).delete();
    return NextResponse.json({ message: "預算已刪除" });
  } catch (err) {
    console.error("[budget] DELETE error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
```

### Step 2: Commit

```bash
git add src/app/api/budget/route.ts
git commit -m "fix(api): 修復 budget API hardcode userId，改用 session 動態取得"
```

---

## Task 4: 修復 Dashboard API routes — userId 資料隔離

以下 5 個 routes 沒有 userId 過濾，會回傳所有用戶的資料。

**Files:**

- Modify: `src/app/api/accounting/route.ts`
- Modify: `src/app/api/archive/route.ts`
- Modify: `src/app/api/recurring/route.ts`
- Modify: `src/app/api/rules/route.ts`
- Modify: `src/app/api/insights/route.ts`

### Step 1: 修改 accounting/route.ts GET handler

在 `collection("accounting")` 後加上 `where("userId", "==", userId)`：

```typescript
// src/app/api/accounting/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db as adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import type { AccountingEntryView } from "@/models/schema";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const tag = searchParams.get("tag");

    let query = adminDb
      .collection("accounting")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (tag && tag !== "all") {
      query = query.where("tag", "==", tag) as typeof query;
    }

    const snapshot = await query.get();
    const entries: AccountingEntryView[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : (data.createdAt ?? null),
      } as AccountingEntryView;
    });

    return NextResponse.json({ entries, total: entries.length });
  } catch (error) {
    console.error("[API/accounting] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounting data" },
      { status: 500 },
    );
  }
}
```

### Step 2: 修改 archive/route.ts GET handler

在 `collection("archive")` 加上 userId 過濾（只改 GET 的 Firestore query 部分，其他 POST/DELETE 保持原樣只需加 userId 驗證）：

關鍵改動：

```typescript
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

// GET 函式開頭加：
const userId = await getSessionUserId();
if (!userId)
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// query 改為：
const snapshot = await adminDb
  .collection("archive")
  .where("userId", "==", userId)
  .orderBy("createdAt", "desc")
  .limit(q ? 100 : limit)
  .get();
```

### Step 3: 修改 recurring/route.ts

```typescript
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

// GET 函式：
const userId = await getSessionUserId();
if (!userId)
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// query 改為：
const snapshot = await db
  .collection("recurring_expenses")
  .where("userId", "==", userId)
  .orderBy("createdAt", "desc")
  .get();

// POST 函式：新增 userId 到 document
await db.collection("recurring_expenses").add({
  ...result.data,
  userId, // 新增這行
  createdAt: new Date(),
});
```

### Step 4: 修改 rules/route.ts

```typescript
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

// GET:
const userId = await getSessionUserId();
if (!userId)
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const snapshot = await db
  .collection("classification_rules")
  .where("userId", "==", userId)
  .orderBy("lastUsed", "desc")
  .get();

// POST: 新增 userId 到 document
await db.collection("classification_rules").add({
  ...validated,
  userId, // 新增這行
  count: 0,
  lastUsed: new Date(),
  createdAt: new Date(),
});
```

### Step 5: 修改 insights/route.ts

```typescript
// src/app/api/insights/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateFinancialInsights } from "@/services/insights";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

// 改為 per-user 快取（key 為 userId）
const insightCache = new Map<string, { insight: string; updatedAt: number }>();

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    const now = Date.now();
    const cached = insightCache.get(userId);

    if (!force && cached && now - cached.updatedAt < 3600000) {
      return NextResponse.json({ insight: cached.insight, cached: true });
    }

    const insight = await generateFinancialInsights(userId);
    insightCache.set(userId, { insight, updatedAt: now });

    return NextResponse.json({ insight, cached: false });
  } catch (error) {
    console.error("GET /api/insights error:", error);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 },
    );
  }
}
```

### Step 6: Commit

```bash
git add src/app/api/accounting/route.ts src/app/api/archive/route.ts \
        src/app/api/recurring/route.ts src/app/api/rules/route.ts \
        src/app/api/insights/route.ts
git commit -m "fix(api): 所有 Dashboard API routes 補上 userId 資料隔離過濾"
```

---

## Task 5: 修復 Cron Jobs Firestore 查詢缺少 userId 過濾

注意：Cron jobs 沒有登入 session，要從 `getAllLineUserIds()` 拿到所有用戶，逐一查詢。

本 task 先建立「單用戶邏輯」helper，下一 task 再迭代所有用戶。

**Files:**

- Modify: `src/app/api/cron/daily-summary/route.ts`
- Modify: `src/app/api/cron/calendar-remind/route.ts`
- Modify: `src/app/api/cron/monthly-report/route.ts`
- Modify: `src/app/api/cron/monthly-sheet/route.ts`

### Step 1: 修改 daily-summary — 查詢加 userId filter

在 `collection("accounting")` 的兩個查詢都加上 `.where("userId", "==", userId)`：

```typescript
// today 消費查詢
const todaySnap = await db
  .collection("accounting")
  .where("userId", "==", userId) // ← 新增
  .where("date", "==", today)
  .get();

// 本月累計查詢
const monthSnap = await db
  .collection("accounting")
  .where("userId", "==", userId) // ← 新增
  .where("date", ">=", monthStart)
  .where("date", "<=", today)
  .get();
```

### Step 2: 修改 calendar-remind — 查詢加 userId filter

```typescript
// 今日行程
const calSnap = await db
  .collection("calendar")
  .where("userId", "==", userId) // ← 新增
  .where("actionDate", "==", today)
  .get();

// 待辦
const pendingSnap = await db
  .collection("calendar")
  .where("userId", "==", userId) // ← 新增
  .where("status", "==", "pending")
  .get();
```

### Step 3: 修改 monthly-report — 查詢加 userId filter

```typescript
// 上月消費
const snap = await db
  .collection("accounting")
  .where("userId", "==", userId) // ← 新增
  .where("date", ">=", from)
  .where("date", "<=", to)
  .get();

// 上上月消費
const prevSnap = await db
  .collection("accounting")
  .where("userId", "==", userId) // ← 新增
  .where("date", ">=", prevFrom)
  .where("date", "<=", prevTo)
  .get();
```

### Step 4: 修改 monthly-sheet — 查詢加 userId filter

```typescript
const snap = await db
  .collection("accounting")
  .where("userId", "==", userId) // ← 新增
  .where("date", ">=", monthStart)
  .where("date", "<=", monthEnd)
  .orderBy("date", "asc")
  .get();
```

### Step 5: Commit

```bash
git add src/app/api/cron/daily-summary/route.ts \
        src/app/api/cron/calendar-remind/route.ts \
        src/app/api/cron/monthly-report/route.ts \
        src/app/api/cron/monthly-sheet/route.ts
git commit -m "fix(cron): 補上所有 Cron 查詢的 userId 過濾，修正資料混雜問題"
```

---

## Task 6: Cron Jobs 改為多用戶迭代

**Files:**

- Modify: `src/app/api/cron/daily-summary/route.ts`
- Modify: `src/app/api/cron/calendar-remind/route.ts`
- Modify: `src/app/api/cron/monthly-report/route.ts`
- Modify: `src/app/api/cron/diary-prompt/route.ts`

將原本「拿 `LINE_USER_ID` → 處理 → 推播」的流程，改為「取所有 userId → for 迴圈逐一處理推播」。

### Step 1: 修改 daily-summary

```typescript
import { getAllLineUserIds } from "@/lib/userRegistry";

export async function GET(req: Request) {
  // ... auth check ...

  const userIds = getAllLineUserIds();
  if (userIds.length === 0) {
    return NextResponse.json(
      { error: "LINE_USER_IDS not set" },
      { status: 500 },
    );
  }

  const results: Array<{
    userId: string;
    todayTotal: number;
    monthTotal: number;
  }> = [];

  for (const userId of userIds) {
    try {
      // 同原本邏輯，但每次 loop 用當下的 userId 查詢
      // ... today 查詢、月累計查詢、推播 ...
      results.push({ userId, todayTotal, monthTotal });
    } catch (err) {
      console.error(`[daily-summary] Error for user ${userId}:`, err);
    }
  }

  return NextResponse.json({ status: "ok", results });
}
```

**注意：** 要把原本函式主體裡的查詢和推播邏輯完整保留，只是包在 `for (const userId of userIds)` 迴圈內。

### Step 2: 修改 calendar-remind（同樣模式）

```typescript
import { getAllLineUserIds } from "@/lib/userRegistry";

// 把原本的 userId 從 env var 改為迴圈變數
const userIds = getAllLineUserIds();
for (const userId of userIds) {
  try {
    // 原本的查詢 + 推播邏輯
  } catch (err) {
    console.error(`[calendar-remind] Error for user ${userId}:`, err);
  }
}
```

### Step 3: 修改 monthly-report（同樣模式）

月報含 AI insights，每個用戶要分別呼叫 `generateFinancialInsights(userId)`。

### Step 4: 修改 diary-prompt（無查詢，只推播）

```typescript
import { getAllLineUserIds } from "@/lib/userRegistry";

const userIds = getAllLineUserIds();
for (const userId of userIds) {
  await lineService.pushText(userId, diaryMessage);
}
```

### Step 5: Commit

```bash
git add src/app/api/cron/daily-summary/route.ts \
        src/app/api/cron/calendar-remind/route.ts \
        src/app/api/cron/monthly-report/route.ts \
        src/app/api/cron/diary-prompt/route.ts
git commit -m "feat(cron): daily-summary/calendar-remind/monthly-report/diary-prompt 改為多用戶迭代推播"
```

---

## Task 7: 修復 recurring cron — 加 userId filter 與通知多用戶

**Files:**

- Modify: `src/app/api/cron/recurring/route.ts`

recurring 目前查詢所有人的定期支出，且 `accounting` 插入時沒有帶 userId。

### Step 1: 查詢加 userId filter

```typescript
import { getAllLineUserIds } from "@/lib/userRegistry";

// 替換現有邏輯：
const userIds = getAllLineUserIds();

for (const userId of userIds) {
  const recurringSnap = await db
    .collection("recurring_expenses")
    .where("userId", "==", userId) // ← 新增
    .where("isActive", "==", true)
    .get();

  const triggeredList: string[] = [];

  for (const doc of recurringSnap.docs) {
    // ... 原本的 shouldTrigger 判斷邏輯 ...

    if (shouldTrigger) {
      const entry: AccountingEntry = {
        userId, // ← 新增，確保插入的帳目有正確 userId
        amount,
        tag,
        description: `${description} [定期]`,
        date: todayStr,
        source: "system",
        originalText: `System: recurring ${doc.id}`,
        createdAt: new Date(),
      };
      await db.collection("accounting").add(entry);
      await doc.ref.update({ lastTriggeredAt: todayStr });
      triggeredList.push(`- $${amount} [${tag}] ${description}`);
    }
  }

  // 有觸發才推播，推給當前 userId
  if (triggeredList.length > 0) {
    await lineService.pushText(
      userId,
      ["🔄 定期支出已入帳", "━━━━━━━━━━━━", ...triggeredList].join("\n"),
    );
  }
}
```

### Step 2: Commit

```bash
git add src/app/api/cron/recurring/route.ts
git commit -m "fix(cron): recurring 補上 userId 隔離，定期支出入帳帶 userId，通知推給各用戶"
```

---

## Task 8: monthly-sheet 維持管理員專屬，threads-summary 推給所有用戶

**Files:**

- Modify: `src/app/api/cron/monthly-sheet/route.ts`（維持單用戶，但改用 `LINE_USER_ID`，保持明確）
- Modify: `src/app/api/cron/threads-summary/route.ts`（改推給所有用戶）

### Step 1: monthly-sheet — 保持只推給管理員

monthly-sheet 是匯出到 Google Sheets，這是個人功能，維持只跑管理員的資料。

只需確認用的是管理員的 userId（`LINE_USER_ID`），並在查詢加上 userId filter（Task 5 已完成）。

不需額外改動，Task 5 已修正查詢。

### Step 2: threads-summary — 改推給所有用戶

Threads 摘要是全域內容，可以推給所有人。

```typescript
import { getAllLineUserIds } from "@/lib/userRegistry";

// 在 lineService.pushText 推播前：
const userIds = getAllLineUserIds();
await Promise.all(
  userIds.map((uid) => lineService.pushText(uid, finalMessage)),
);
```

刪除原本的：

```typescript
// 刪掉這行
await lineService.pushText(userId, finalMessage);
```

### Step 3: Commit

```bash
git add src/app/api/cron/threads-summary/route.ts
git commit -m "feat(cron): threads-summary 改為推播給所有用戶"
```

---

## Task 9: 環境變數設定與 Vercel 部署

**Files:**

- Modify: `.env.local`（本地開發用，不提交）
- Modify: `vercel.json` 或 Vercel Dashboard 環境變數

### Step 1: 更新 .env.local（本地開發）

```bash
# 在 .env.local 新增以下兩行
LINE_USER_IDS="你的LINE_USER_ID,媽媽的LINE_USER_ID"
EMAIL_LINE_MAP="你的gmail@gmail.com:你的LINE_USER_ID,媽媽的gmail@gmail.com:媽媽的LINE_USER_ID"
```

**如何取得媽媽的 LINE User ID？**
媽媽加 Bot 好友並傳訊息後，可在 Vercel Function Logs 看到 `userId`（格式 `Uxxxxxxxxx`）。

### Step 2: 更新 Vercel 環境變數

在 Vercel Dashboard → Settings → Environment Variables 新增：

- `LINE_USER_IDS`
- `EMAIL_LINE_MAP`

### Step 3: 媽媽 Dashboard 存取

在 `AUTHORIZED_EMAILS` 加入媽媽的 Google 帳號 email（逗號分隔）。

### Step 4: Commit（記得 .env.local 不提交）

```bash
# 確認 .env.local 在 .gitignore 中（應該已有）
git status  # 確認 .env.local 不在 staged files
git commit -m "docs: 記錄多用戶環境變數設定說明於 CLAUDE.md"
```

---

## 測試驗證

### 本地測試 userRegistry

```bash
# 設定環境變數後執行
LINE_USER_IDS="Uxxx,Uyyy" EMAIL_LINE_MAP="test@gmail.com:Uxxx" \
  npx tsx -e "
  const { getAllLineUserIds, getLineUserIdFromEmail } = require('./src/lib/userRegistry');
  console.log(getAllLineUserIds());
  console.log(getLineUserIdFromEmail('test@gmail.com'));
  "
```

### 本地測試 Dashboard 隔離

1. 以你的帳號登入 Dashboard → 記帳頁 → 確認只看到你的資料
2. 以媽媽的帳號登入 Dashboard → 記帳頁 → 確認只看到她的資料（初始應為空）

### 本地測試 Cron（手動觸發）

```bash
# 用 CRON_SECRET 直接呼叫
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-summary
```

---

## Firestore 複合索引提醒

加上 `userId` 過濾後，以下查詢可能需要在 Firestore Console 建立複合索引：

| Collection             | 索引欄位                        |
| ---------------------- | ------------------------------- |
| `accounting`           | `userId ASC` + `createdAt DESC` |
| `accounting`           | `userId ASC` + `date ASC`       |
| `calendar`             | `userId ASC` + `actionDate ASC` |
| `calendar`             | `userId ASC` + `status ASC`     |
| `recurring_expenses`   | `userId ASC` + `isActive ASC`   |
| `classification_rules` | `userId ASC` + `lastUsed DESC`  |

如果部署後 Vercel Logs 出現 `FAILED_PRECONDITION` 錯誤，點選 Firebase 提供的連結自動建立即可。

---

## 完成後驗證清單

- [ ] 媽媽發訊息給 Bot，記帳成功，資料存在 Firestore（有她自己的 userId）
- [ ] 你的 Dashboard 只看到你的資料
- [ ] 媽媽的 Dashboard 只看到她的資料
- [ ] 21:00 Cron 兩人都收到各自的每日摘要
- [ ] 00:05 Cron 媽媽的定期支出正確插入（若有設定）
- [ ] 月報各自推送各自的帳目
- [ ] Threads 摘要兩人都收到
