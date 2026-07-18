import { db } from "@/lib/firebase/admin";
import { getTagEmoji } from "@/utils/tagEmoji";
import { myExpenseTWD } from "@/utils/currency";
import { RAGService } from "./rag.service";
import { getEventsFromGoogleCalendar } from "@/lib/calendar/client";
import type { AccountingEntry, ArchiveEntry, CalendarEntry } from "@/models/schema";

interface QueryFilter {
    userId: string;
    queryType: "expense" | "archive" | "calendar" | "semantic_search";
    tag?: string;
    period?: string;
    limit?: number;
    semanticQuery?: string;
}

interface QueryResult {
    replyText: string;
}

/**
 * 查詢引擎：接收 Gemini 解析的 query 意圖，查詢 Firestore 並回傳格式化結果
 */
export async function executeQuery(filters: QueryFilter): Promise<QueryResult> {
    if (filters.queryType === "expense") {
        return queryExpense(filters);
    }
    if (filters.queryType === "archive") {
        return queryArchive(filters.limit ?? 5, filters.userId);
    }
    if (filters.queryType === "calendar") {
        return queryCalendar(filters.period, filters.userId);
    }
    if (filters.queryType === "semantic_search" && filters.semanticQuery) {
        return querySemantic(filters.semanticQuery, filters.limit ?? 3, filters.userId);
    }
    return { replyText: "❓ 不支援的查詢類型" };
}

async function queryExpense(filters: QueryFilter): Promise<QueryResult> {
    const range = resolvePeriod(filters.period ?? "this_month");

    const query = db
        .collection("accounting")
        .where("userId", "==", filters.userId)
        .where("date", ">=", range.from)
        .where("date", "<=", range.to) as FirebaseFirestore.Query;

    const snapshot = await query.get();
    let entries = snapshot.docs.map((d) => d.data() as AccountingEntry);

    // tag 篩選
    if (filters.tag) {
        entries = entries.filter((e) => e.tag === filters.tag);
    }

    // 金額一律換算台幣、代墊只計自己份額
    const totalIncome = entries.filter(e => e.tag === "Income").reduce((s, e) => s + myExpenseTWD(e), 0);
    const totalExpense = entries.filter(e => e.tag !== "Income").reduce((s, e) => s + myExpenseTWD(e), 0);
    const netBalance = totalIncome - totalExpense;

    if (entries.length === 0) {
        const tagLabel = filters.tag ? `「${filters.tag}」` : "";
        return { replyText: `📊 ${range.label}${tagLabel}沒有任何消費記錄` };
    }

    // 標籤統計
    const tagMap = new Map<string, number>();
    entries.forEach((e) => {
        const tag = e.tag || "Other";
        tagMap.set(tag, (tagMap.get(tag) || 0) + myExpenseTWD(e));
    });

    const tagLines = Array.from(tagMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, amt]) => {
            const prefix = tag === "Income" ? "➕" : "➖";
            return `\u3000${prefix} ${getTagEmoji(tag)} ${tag}: $${amt.toLocaleString()}`;
        });

    // 最高一筆（僅計支出）
    const expenseEntries = entries.filter(e => e.tag !== "Income");
    const maxEntry = expenseEntries.length > 0
        ? expenseEntries.reduce((max, e) => myExpenseTWD(e) > myExpenseTWD(max) ? e : max)
        : null;

    const totalEntriesCount = entries.length;
    const avgAmount = totalEntriesCount > 0 ? Math.round(totalExpense / Math.max(1, entries.filter(e => e.tag !== "Income").length)) : 0;
    const tagLabel = filters.tag ? `「${filters.tag}」` : "";

    return {
        replyText: [
            `📊 ${range.label}${tagLabel}消費統計`,
            "━━━━━━━━━━━━",
            `📝 共 ${entries.length} 筆資料`,
            `💰 總收入: $${totalIncome.toLocaleString()}`,
            `💸 總支出: $${totalExpense.toLocaleString()}`,
            `⚖️ 淨結餘: $${netBalance.toLocaleString()}`,
            `📈 平均支出/筆: $${avgAmount.toLocaleString()}`,
            `🏆 最高支出: ${maxEntry ? `$${myExpenseTWD(maxEntry).toLocaleString()} (${maxEntry.description || "—"})` : "無支出記錄"}`,
            "",
            ...tagLines,
        ].join("\n"),
    };
}

async function queryArchive(limit: number, userId: string): Promise<QueryResult> {
    const snapshot = await db
        .collection("archive")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

    if (snapshot.empty) {
        return { replyText: "📦 目前沒有任何收藏" };
    }

    const lines = snapshot.docs.map((doc, i) => {
        const d = doc.data() as ArchiveEntry;
        const title = d.title || d.summary?.slice(0, 30) || "無標題";
        return `${i + 1}. ${title}`;
    });

    return {
        replyText: [
            `📦 最近 ${snapshot.size} 筆收藏`,
            "━━━━━━━━━━━━",
            ...lines,
        ].join("\n"),
    };
}

async function querySemantic(semanticQuery: string, limit: number, userId: string): Promise<QueryResult> {
    const results = await RAGService.search(semanticQuery, limit, userId);
    if (results.length === 0) {
        return { replyText: `🔍 找不到與「${semanticQuery}」相關的筆記。` };
    }

    const lines = results.map((d, i) => {
        const title = d.title || d.summary?.slice(0, 30) || "無標題";
        const scorePct = Math.round(d.score * 100);
        return `${i + 1}. [${scorePct}%] ${title}`;
    });

    return {
        replyText: [
            `🔍 關於「${semanticQuery}」的相關筆記`,
            "━━━━━━━━━━━━",
            ...lines,
        ].join("\n"),
    };
}

async function queryCalendar(period: string | undefined, userId: string): Promise<QueryResult> {
    const target = period === "tomorrow"
        ? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    const label = period === "tomorrow" ? "明天" : "今天";

    const snapshot = await db
        .collection("calendar")
        .where("userId", "==", userId)
        .where("actionDate", "==", target)
        .get();

    // 也查沒有日期的 pending 待辦
    const pendingSnapshot = await db
        .collection("calendar")
        .where("userId", "==", userId)
        .where("status", "==", "pending")
        .get();

    const pendingNoDates = pendingSnapshot.docs
        .filter((d) => !d.data().actionDate)
        .map((d) => d.data() as CalendarEntry);

    const firestoreEvents = snapshot.docs.map((d) => d.data() as CalendarEntry);

    // 也查 Google Calendar 原本的行程
    const gcalItems = await getEventsFromGoogleCalendar(target);
    const firestoreGcalIds = new Set(firestoreEvents.filter(e => e.gcalEventId).map(e => e.gcalEventId));

    // 過濾掉已經由 Line Bot 寫入且在 Firestore 裡的行程
    const filteredGcalEvents = gcalItems.filter(e => e.id && !firestoreGcalIds.has(e.id));

    if (firestoreEvents.length === 0 && pendingNoDates.length === 0 && filteredGcalEvents.length === 0) {
        return { replyText: `🗓 ${label}沒有任何行程或待辦` };
    }

    const eventLines = firestoreEvents.map((e) => {
        const time = e.actionTime ? `⏰ ${e.actionTime} ` : "📌 ";
        const status = e.status === "done" ? "✅" : "";
        return `${time}${e.title} ${status}`;
    });

    const gcalLines = filteredGcalEvents.map((e) => {
        const isAllDay = !!e.start?.date;
        let timeStr = "📌";
        if (!isAllDay && e.start?.dateTime) {
            const dateObj = new Date(e.start.dateTime);
            timeStr = `⏰ ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
        }
        return `${timeStr} ${e.summary} (GCal)`;
    });

    const allEventLines = [...eventLines, ...gcalLines];

    const todoLines = pendingNoDates.slice(0, 5).map((e) => `📌 ${e.title}`);

    const sections = [];
    if (allEventLines.length > 0) {
        sections.push(`📅 ${label}行程`, ...allEventLines);
    }
    if (todoLines.length > 0) {
        if (sections.length > 0) sections.push("");
        sections.push("📋 待辦事項", ...todoLines);
    }

    return {
        replyText: [
            `🗓 ${label}行程概覽`,
            "━━━━━━━━━━━━",
            ...sections,
        ].join("\n"),
    };
}

// ─── 工具函數 ────────────────────

function resolvePeriod(period: string): { from: string; to: string; label: string } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    switch (period) {
        case "this_month": {
            const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
            return { from, to: now.toISOString().slice(0, 10), label: "本月" };
        }
        case "last_month": {
            const pm = m === 0 ? 11 : m - 1;
            const py = m === 0 ? y - 1 : y;
            const from = `${py}-${String(pm + 1).padStart(2, "0")}-01`;
            const lastDay = new Date(py, pm + 1, 0).getDate();
            const to = `${py}-${String(pm + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
            return { from, to, label: "上月" };
        }
        case "this_week": {
            const day = now.getDay();
            const monday = new Date(now);
            monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
            return { from: monday.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), label: "本週" };
        }
        case "last_week": {
            const day = now.getDay();
            const lastMonday = new Date(now);
            lastMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7);
            const lastSunday = new Date(lastMonday);
            lastSunday.setDate(lastMonday.getDate() + 6);
            return { from: lastMonday.toISOString().slice(0, 10), to: lastSunday.toISOString().slice(0, 10), label: "上週" };
        }
        case "today": {
            const today = now.toISOString().slice(0, 10);
            return { from: today, to: today, label: "今日" };
        }
        case "tomorrow": {
            const tmr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
            return { from: tmr, to: tmr, label: "明天" };
        }
        default: {
            const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
            return { from, to: now.toISOString().slice(0, 10), label: "本月" };
        }
    }
}
