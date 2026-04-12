import { db } from "@/lib/firebase/admin";
import { addEventToGoogleCalendar } from "@/lib/calendar/client";
import { generateFinancialInsights } from "./insights";
import { getTagEmoji } from "@/utils/tagEmoji";
import { ClassificationEngine } from "./classificationEngine";
import { queryArchiveWithAI } from "./archiveQuery.service";
import { completeTodo } from "./todoComplete.service";
import { listRecentDriveFiles } from "@/lib/drive/client";
import type { AccountingEntry, Budget } from "@/models/schema";

interface QuickCommandResult {
    handled: boolean;
    replyText?: string;
}

/**
 * 快速指令解析器
 * 支援：/記, /查, /待, /help
 * 若文字不以 / 開頭 → { handled: false }
 */
export async function parseQuickCommand(text: string, userId: string): Promise<QuickCommandResult> {
    const trimmed = text.trim();
    if (!trimmed.startsWith("/")) return { handled: false };

    // /help
    if (/^\/help$/i.test(trimmed)) {
        return {
            handled: true,
            replyText: [
                "📖 快速指令說明",
                "━━━━━━━━━━━━",
                "💰 /記 {金額} {說明}",
                "　　例：/記 150 午餐",
                "",
                "🔍 /查 本月",
                "　　/查 上月 / 本週 / 上週",
                "",
                "📌 /待 {標題}",
                "　　例：/待 繳電費",
                "",
                "🧵 /threads 追蹤 {帳號}",
                "　　例：/threads 追蹤 hogan.tech",
                "🧵 /threads 取消 {帳號}",
                "　　例：/threads 取消 hogan.tech",
                "� /threads 清單",
                "　　查看目前追蹤的 Threads 創作者",
                "",
                "🧠 /洞察　　AI 分析消費",
                "📁 /recent_files　查看最近檔案",
                "",
                "💡 不用指令也行，直接打字",
                "　　我會用 AI 自動判斷意圖",
            ].join("\n"),
        };
    }

    // /洞察
    if (/^\/洞察$/i.test(trimmed)) {
        return await handleQuickInsight(userId);
    }

    // /記 {金額} {描述}
    const expenseMatch = trimmed.match(/^\/記\s+(\d+)\s*(.*)$/);
    if (expenseMatch) {
        return await handleQuickExpense(Number(expenseMatch[1]), expenseMatch[2].trim(), userId);
    }

    // /查 {時間}
    const queryMatch = trimmed.match(/^\/查\s+(.+)$/);
    if (queryMatch) {
        return await handleQuickQuery(queryMatch[1].trim(), userId);
    }

    // /待 {標題}
    const todoMatch = trimmed.match(/^\/待\s+(.+)$/);
    if (todoMatch) {
        return await handleQuickTodo(todoMatch[1].trim(), userId);
    }

    // /完成 {關鍵字}
    const completeMatch = trimmed.match(/^\/完成\s+(.+)$/);
    if (completeMatch) {
        const result = await completeTodo(completeMatch[1].trim());
        return { handled: true, replyText: result.message };
    }

    // /recent_files
    if (/^\/recent_files$/i.test(trimmed)) {
        return await handleRecentFiles();
    }

    // /問 {問題}
    const askMatch = trimmed.match(/^\/問\s+(.+)$/);
    if (askMatch) {
        return await handleArchiveQuery(askMatch[1].trim());
    }

    // /預算 — 查看或設定預算
    if (/^\/預算$/.test(trimmed)) {
        return await handleBudgetQuery(userId);
    }
    const budgetSetMatch = trimmed.match(/^\/預算\s+設定\s+(\d+)$/);
    if (budgetSetMatch) {
        return await handleBudgetSet(userId, Number(budgetSetMatch[1]));
    }

    // /threads 追蹤 {username}
    const threadsAddMatch = trimmed.match(/^\/threads\s+追蹤\s+@?([\w.]+)$/i);
    if (threadsAddMatch) {
        return await handleThreadsAdd(threadsAddMatch[1]);
    }

    // /threads 取消 {username}
    const threadsRemoveMatch = trimmed.match(/^\/threads\s+取消\s+@?([\w.]+)$/i);
    if (threadsRemoveMatch) {
        return await handleThreadsRemove(threadsRemoveMatch[1]);
    }

    // /threads 清單
    if (/^\/threads\s+清單$/i.test(trimmed)) {
        return await handleThreadsList();
    }

    // 未知指令
    return {
        handled: true,
        replyText: `❓ 不認識的指令「${trimmed.split(" ")[0]}」\n\n輸入 /help 看所有指令`,
    };
}

/** /記 — 快速記帳 */
async function handleQuickExpense(amount: number, description: string, userId: string): Promise<QuickCommandResult> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const tag = guessTag(description);

    const entry = {
        userId,
        amount,
        tag,
        date: dateStr,
        description: description || "快速記帳",
        originalText: `/記 ${amount} ${description}`,
        source: "line-quick",
        createdAt: new Date(),
    };

    await db.collection("accounting").add(entry);

    // 學習規則（非同步不等待，不阻塞回覆）
    if (description && tag !== "Other") {
        ClassificationEngine.learn(description, tag, userId).catch(() => { /* 失敗不影響主流程 */ });
    }

    return {
        handled: true,
        replyText: [
            "✅ 快速記帳成功",
            "━━━━━━━━━━━━",
            `💰 $${amount.toLocaleString()}`,
            `📝 ${entry.description}`,
            `🏷 ${tag}`,
            `📅 ${dateStr}`,
        ].join("\n"),
    };
}

/** /查 — 快速查詢 */
async function handleQuickQuery(period: string, userId: string): Promise<QuickCommandResult> {
    const range = parsePeriod(period);
    if (!range) {
        return {
            handled: true,
            replyText: `❓ 不認識「${period}」\n\n支援：本月、上月、本週、上週、今天`,
        };
    }

    const snapshot = await db
        .collection("accounting")
        .where("userId", "==", userId)
        .where("date", ">=", range.from)
        .where("date", "<=", range.to)
        .get();

    const entries = snapshot.docs.map((d) => d.data() as AccountingEntry);

    const income = entries.filter((e) => e.tag === "Income").reduce((s, e) => s + (e.amount || 0), 0);
    const expenses = entries.filter((e) => e.tag !== "Income").reduce((s, e) => s + (e.amount || 0), 0);

    // 標籤統計（排除 Income）
    const tagMap = new Map<string, number>();
    entries.forEach((e) => {
        const tag = e.tag || "Other";
        tagMap.set(tag, (tagMap.get(tag) || 0) + (e.amount || 0));
    });

    const tagLines = Array.from(tagMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, amt]) => `\u3000${getTagEmoji(tag)} ${tag}: $${amt.toLocaleString()}`);

    const summaryLines = [
        `📊 ${range.label}統計`,
        "━━━━━━━━━━━━",
        `📝 共 ${entries.length} 筆`,
        `💸 支出 $${expenses.toLocaleString()}`,
        ...(income > 0 ? [`💵 收入 $${income.toLocaleString()}`, `📈 結餘 $${(income - expenses).toLocaleString()}`] : []),
        "",
        ...tagLines,
    ];

    return {
        handled: true,
        replyText: summaryLines.join("\n"),
    };
}

/** /待 — 快速待辦 */
async function handleQuickTodo(title: string, userId: string): Promise<QuickCommandResult> {
    const entry = {
        userId,
        title,
        status: "pending",
        source: "line-quick",
        createdAt: new Date(),
    };

    // 嘗試寫入 Google Calendar
    let gcalNote = "";
    try {
        const gcalEventId = await addEventToGoogleCalendar(entry);
        if (gcalEventId) {
            (entry as Record<string, unknown>).gcalEventId = gcalEventId;
            gcalNote = "\n✅ 已同步 Google Calendar";
        }
    } catch {
        gcalNote = "\n⚠️ Google Calendar 同步失敗";
    }

    await db.collection("calendar").add(entry);

    return {
        handled: true,
        replyText: [
            "📌 待辦已建立",
            "━━━━━━━━━━━━",
            `📋 ${title}`,
            `📊 狀態: pending`,
            gcalNote,
        ].join("\n"),
    };
}

/** /洞察 — 快速洞察 */
async function handleQuickInsight(userId: string): Promise<QuickCommandResult> {
    const insight = await generateFinancialInsights(userId);
    return {
        handled: true,
        replyText: [
            "🧠 AI 理財洞察",
            "━━━━━━━━━━━━",
            insight,
        ].join("\n"),
    };
}

// ─── 工具函數 ────────────────────────────────────

/** 從描述推斷標籤（簡易版） */
function guessTag(desc: string): string {
    const lower = desc.toLowerCase();
    const rules: [string[], string][] = [
        [["早餐", "午餐", "晚餐", "吃", "餐", "飯", "麵", "便當", "火鍋", "壽司", "拉麵", "咖啡", "飲料", "手搖", "茶", "奶茶", "雞排", "滷味", "pizza", "food"], "Food"],
        [["uber", "計程", "加油", "捷運", "公車", "停車", "高鐵", "台鐵", "機票", "油費", "taxi", "transport"], "Transport"],
        [["電影", "遊戲", "netflix", "spotify", "ktv", "唱歌", "演唱會", "門票", "switch"], "Entertainment"],
        [["水費", "電費", "瓦斯", "網路", "手機", "電信", "帳單", "房租", "房租費", "管理費", "家裡伙食費", "伙食費分攤", "伙食費", "家裡分攤"], "Utilities"],
        [["衣服", "鞋", "包", "蝦皮", "momo", "pchome", "購物", "買", "日用品"], "Shopping"],
        [["看醫", "掛號", "藥", "醫院", "診所", "牙醫", "health", "保健"], "Health"],
        [["書", "課程", "學費", "udemy", "補習", "考試", "文具"], "Education"],
        [["保險", "保費", "保險費", "壽險", "車險", "產險", "醫療險", "意外險"], "Insurance"],
        [["訂閱", "subscription", "youtube premium", "youtube music", "chatgpt", "claude", "notion", "adobe", "apple one", "icloud", "會員費", "月費", "年費"], "Subscription"],
        [["才藝", "鋼琴", "吉他", "畫畫", "舞蹈", "游泳課", "烹飪課", "語言課", "英文課", "日文課", "線上課", "線上學習", "coursera", "hahow", "skillshare"], "Education"],
    ];

    for (const [keywords, tag] of rules) {
        if (keywords.some((kw) => lower.includes(kw))) return tag;
    }
    return "Other";
}

/** 將「本月」「上月」等轉換為日期範圍 */
function parsePeriod(period: string): { from: string; to: string; label: string } | null {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based

    if (period === "本月" || period === "這個月") {
        const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        const to = now.toISOString().slice(0, 10);
        return { from, to, label: "本月" };
    }
    if (period === "上月" || period === "上個月") {
        const pm = m === 0 ? 11 : m - 1;
        const py = m === 0 ? y - 1 : y;
        const from = `${py}-${String(pm + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(py, pm + 1, 0).getDate();
        const to = `${py}-${String(pm + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        return { from, to, label: "上月" };
    }
    if (period === "本週" || period === "這週") {
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        return { from: monday.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), label: "本週" };
    }
    if (period === "上週") {
        const day = now.getDay();
        const lastMonday = new Date(now);
        lastMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        return { from: lastMonday.toISOString().slice(0, 10), to: lastSunday.toISOString().slice(0, 10), label: "上週" };
    }
    if (period === "今天" || period === "今日") {
        const today = now.toISOString().slice(0, 10);
        return { from: today, to: today, label: "今日" };
    }
    return null;
}

/** /問 — Archive RAG 問答 */
async function handleArchiveQuery(question: string): Promise<QuickCommandResult> {
    const answer = await queryArchiveWithAI(question);
    return {
        handled: true,
        replyText: [
            "💬 知識庫查詢",
            "━━━━━━━━━━━━",
            answer,
        ].join("\n"),
    };
}

/** /recent_files — 列出最近 5 筆上傳到 Drive 的檔案 */
async function handleRecentFiles(): Promise<QuickCommandResult> {
    try {
        const files = await listRecentDriveFiles(5);
        if (files.length === 0) {
            return { handled: true, replyText: "📭 尚無上傳紀錄" };
        }

        const lines = files.map((f, i) => {
            const dt = f.modifiedTime
                ? new Date(f.modifiedTime).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })
                : "";
            return `${i + 1}. 📄 ${f.name}\n　　🕒 ${dt}`;
        });

        return {
            handled: true,
            replyText: [
                "📁 最近上傳的 5 個檔案",
                "━━━━━━━━━━━━",
                ...lines,
            ].join("\n"),
        };
    } catch (e) {
        console.error("[recent_files]", e);
        return { handled: true, replyText: "⚠️ 讀取 Drive 失敗，請稍後再試" };
    }
}

/** /預算 — 查看本月預算使用狀況 */
async function handleBudgetQuery(userId: string): Promise<QuickCommandResult> {
    try {
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const monthStart = `${ym}-01`;
        const monthEnd = `${ym}-31`;

        const budgetSnap = await db.collection("budgets").where("userId", "==", userId).get();
        if (budgetSnap.empty) {
            return {
                handled: true,
                replyText: "\ud83d\udcca 尚未設定預算\n\n輸入 /預算 設定 5000 來設定月預算",
            };
        }

        const accSnap = await db.collection("accounting")
            .where("userId", "==", userId)
            .where("date", ">=", monthStart)
            .where("date", "<=", monthEnd)
            .get();
        const monthTotal = accSnap.docs.reduce((s, d) => s + ((d.data() as AccountingEntry).amount || 0), 0);

        const lines = budgetSnap.docs.map(d => {
            const b = d.data() as Budget;
            const tag = b.tag || "總";
            const limit = b.monthlyLimit;
            const ratio = Math.round((monthTotal / limit) * 100);
            return `${tag === "總" ? "📊" : getTagEmoji(tag)} ${tag}預算: $${monthTotal.toLocaleString()} / $${limit.toLocaleString()} (${ratio}%)`;
        });

        return {
            handled: true,
            replyText: [
                `📊 ${ym} 預算狀況`,
                "━━━━━━━━━━━━",
                ...lines,
            ].join("\n"),
        };
    } catch {
        return { handled: true, replyText: "⚠️ 查詢預算失敗" };
    }
}

/** /預算 設定 — 設定月總預算 */
async function handleBudgetSet(userId: string, amount: number): Promise<QuickCommandResult> {
    try {
        const existing = await db.collection("budgets")
            .where("userId", "==", userId)
            .where("tag", "==", null)
            .get();

        if (!existing.empty) {
            await existing.docs[0].ref.update({ monthlyLimit: amount, updatedAt: new Date() });
        } else {
            await db.collection("budgets").add({
                userId,
                tag: null,
                monthlyLimit: amount,
                createdAt: new Date(),
            });
        }

        return {
            handled: true,
            replyText: `✅ 月總預算已設定為 $${amount.toLocaleString()}\n超過 80% 時我會提醒你！`,
        };
    } catch {
        return { handled: true, replyText: "⚠️ 設定預算失敗" };
    }
}

// ─── Threads 管理指令 ─────────────────────────────

/** /threads 追蹤 {username} */
async function handleThreadsAdd(username: string): Promise<QuickCommandResult> {
    try {
        const cleanUsername = username.replace(/^@/, "").toLowerCase();
        // Upsert：用 username 當 doc ID 避免重複
        await db.collection("threads_users").doc(cleanUsername).set({
            username: cleanUsername,
            maxPosts: 10,
            addedAt: new Date(),
            source: "line-bot",
        }, { merge: true });

        return {
            handled: true,
            replyText: [
                "✅ 已加入 Threads 追蹤",
                "━━━━━━━━━━━━",
                `🧵 @${cleanUsername}`,
                "",
                "下次爬蟲執行時開始監控。",
                "有新貼文我會直接推播到此！",
            ].join("\n"),
        };
    } catch {
        return { handled: true, replyText: "⚠️ 新增追蹤失敗，請稍後再試" };
    }
}

/** /threads 取消 {username} */
async function handleThreadsRemove(username: string): Promise<QuickCommandResult> {
    try {
        const cleanUsername = username.replace(/^@/, "").toLowerCase();
        const docRef = db.collection("threads_users").doc(cleanUsername);
        const doc = await docRef.get();

        if (!doc.exists) {
            return {
                handled: true,
                replyText: `❌ 找不到追蹤的 @${cleanUsername}\n\n用 /threads 清單 查看目前的追蹤名單`,
            };
        }

        await docRef.delete();

        return {
            handled: true,
            replyText: [
                "🗑️ 已取消 Threads 追蹤",
                "━━━━━━━━━━━━",
                `🧵 @${cleanUsername}`,
            ].join("\n"),
        };
    } catch {
        return { handled: true, replyText: "⚠️ 取消追蹤失敗，請稍後再試" };
    }
}

/** /threads 清單 */
async function handleThreadsList(): Promise<QuickCommandResult> {
    try {
        const snapshot = await db.collection("threads_users").orderBy("addedAt", "asc").get();

        if (snapshot.empty) {
            return {
                handled: true,
                replyText: [
                    "🧵 目前沒有透過 LINE 新增的追蹤",
                    "",
                    "用以下指令新增：",
                    "/threads 追蹤 hogan.tech",
                ].join("\n"),
            };
        }

        const lines = snapshot.docs.map((d, i) => {
            const data = d.data();
            return `${i + 1}. @${data.username}`;
        });

        return {
            handled: true,
            replyText: [
                `🧵 Threads 追蹤清單（${snapshot.size} 位）`,
                "━━━━━━━━━━━━",
                ...lines,
                "",
                "新增：/threads 追蹤 {帳號}",
                "取消：/threads 取消 {帳號}",
            ].join("\n"),
        };
    } catch {
        return { handled: true, replyText: "⚠️ 讀取清單失敗，請稍後再試" };
    }
}
