import { db } from "@/lib/firebase/admin";
import { addEventToGoogleCalendar } from "@/lib/calendar/client";
import { generateFinancialInsights } from "./insights";

interface QuickCommandResult {
    handled: boolean;
    replyText?: string;
}

/**
 * 快速指令解析器
 * 支援：/記, /查, /待, /help
 * 若文字不以 / 開頭 → { handled: false }
 */
export async function parseQuickCommand(text: string): Promise<QuickCommandResult> {
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
                "　　/查 上月",
                "　　/查 本週",
                "　　/查 上週",
                "",
                "📌 /待 {標題}",
                "　　例：/待 繳電費",
                "",
                "🧠 /洞察",
                "　　例：AI 分析近期消費狀況",
                "",
                "💡 不用指令也行，直接打字",
                "　　我會用 AI 自動判斷意圖",
                "　　或貼收據截圖我也能讀喔！",
            ].join("\n"),
        };
    }

    // /洞察
    if (/^\/洞察$/i.test(trimmed)) {
        return await handleQuickInsight();
    }

    // /記 {金額} {描述}
    const expenseMatch = trimmed.match(/^\/記\s+(\d+)\s*(.*)$/);
    if (expenseMatch) {
        return await handleQuickExpense(Number(expenseMatch[1]), expenseMatch[2].trim());
    }

    // /查 {時間}
    const queryMatch = trimmed.match(/^\/查\s+(.+)$/);
    if (queryMatch) {
        return await handleQuickQuery(queryMatch[1].trim());
    }

    // /待 {標題}
    const todoMatch = trimmed.match(/^\/待\s+(.+)$/);
    if (todoMatch) {
        return await handleQuickTodo(todoMatch[1].trim());
    }

    // 未知指令
    return {
        handled: true,
        replyText: `❓ 不認識的指令「${trimmed.split(" ")[0]}」\n\n輸入 /help 看所有指令`,
    };
}

/** /記 — 快速記帳 */
async function handleQuickExpense(amount: number, description: string): Promise<QuickCommandResult> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const tag = guessTag(description);

    const entry = {
        amount,
        tag,
        date: dateStr,
        description: description || "快速記帳",
        originalText: `/記 ${amount} ${description}`,
        source: "line-quick",
        createdAt: new Date(),
    };

    await db.collection("accounting").add(entry);

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
async function handleQuickQuery(period: string): Promise<QuickCommandResult> {
    const range = parsePeriod(period);
    if (!range) {
        return {
            handled: true,
            replyText: `❓ 不認識「${period}」\n\n支援：本月、上月、本週、上週、今天`,
        };
    }

    const snapshot = await db
        .collection("accounting")
        .where("date", ">=", range.from)
        .where("date", "<=", range.to)
        .get();

    const entries = snapshot.docs.map((d) => d.data());
    const total = entries.reduce((s, e) => s + ((e.amount as number) || 0), 0);

    // 標籤統計
    const tagMap = new Map<string, number>();
    entries.forEach((e) => {
        const tag = (e.tag as string) || "Other";
        tagMap.set(tag, (tagMap.get(tag) || 0) + ((e.amount as number) || 0));
    });

    const tagLines = Array.from(tagMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, amt]) => `　${tagEmoji(tag)} ${tag}: $${amt.toLocaleString()}`);

    return {
        handled: true,
        replyText: [
            `📊 ${range.label}消費統計`,
            "━━━━━━━━━━━━",
            `📝 共 ${entries.length} 筆`,
            `💰 合計 $${total.toLocaleString()}`,
            "",
            ...tagLines,
        ].join("\n"),
    };
}

/** /待 — 快速待辦 */
async function handleQuickTodo(title: string): Promise<QuickCommandResult> {
    const entry = {
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
async function handleQuickInsight(): Promise<QuickCommandResult> {
    const insight = await generateFinancialInsights("default_user");
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
        [["水費", "電費", "瓦斯", "網路", "手機", "電信", "帳單", "房租", "管理費"], "Utilities"],
        [["衣服", "鞋", "包", "蝦皮", "momo", "pchome", "購物", "買", "日用品"], "Shopping"],
        [["看醫", "掛號", "藥", "醫院", "診所", "牙醫", "health", "保健"], "Health"],
        [["書", "課程", "學費", "udemy", "補習", "考試", "文具"], "Education"],
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

/** 標籤 emoji */
function tagEmoji(tag: string): string {
    const map: Record<string, string> = {
        Food: "🍽",
        Transport: "🚗",
        Entertainment: "🎬",
        Utilities: "💡",
        Shopping: "🛒",
        Health: "🏥",
        Education: "📚",
        Other: "📦",
    };
    return map[tag] || "📦";
}
