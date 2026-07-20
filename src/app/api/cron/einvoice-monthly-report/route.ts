import { NextResponse } from "next/server";
import { getParentsMonthlySummary } from "@/services/invoiceImport.service";
import { getAuthorizedEmail } from "@/lib/gmail/client";
import { getAllLineUserIds, getLineUserIdFromEmail } from "@/lib/userRegistry";
import { lineService } from "@/services/line.service";
import { getTagEmoji } from "@/utils/tagEmoji";

function monthOf(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 爸媽消費月報（生活共同體視角，資料來源：einvoice_records 家庭帳）
 * Vercel Cron: 10 1 1 * * (UTC) -> 台灣時間每月 1 日 09:10（接在個人月報 09:00 後）
 * 報上個月：總額、佔全家比、種類分布、常去商家、常買品項、與前月比較。
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const email = await getAuthorizedEmail();
        const userId = (email && getLineUserIdFromEmail(email)) || getAllLineUserIds()[0];
        if (!userId) {
            return NextResponse.json({ error: "無法解析 userId" }, { status: 500 });
        }

        // 上個月與前前月（做環比）
        const now = new Date();
        const lastMonth = monthOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        const prevMonth = monthOf(new Date(now.getFullYear(), now.getMonth() - 2, 1));

        const [summary, prev] = await Promise.all([
            getParentsMonthlySummary(userId, lastMonth),
            getParentsMonthlySummary(userId, prevMonth),
        ]);

        if (summary.count === 0) {
            return NextResponse.json({ status: "ok", month: lastMonth, skipped: "該月無爸媽發票" });
        }

        const pct = summary.familyTotal > 0 ? Math.round((summary.total / summary.familyTotal) * 100) : 0;
        const momLine = prev.total > 0
            ? [`📈 前月 $${prev.total.toLocaleString("zh-TW")}（${summary.total >= prev.total ? "+" : ""}${Math.round(((summary.total - prev.total) / prev.total) * 100)}%）`]
            : [];

        const tagLines = summary.tags.slice(0, 5).map(([tag, amt]) =>
            `${getTagEmoji(tag)} ${tag} $${amt.toLocaleString("zh-TW")}（${summary.total > 0 ? Math.round((amt / summary.total) * 100) : 0}%）`
        );
        const merchantLine = summary.merchants.slice(0, 3)
            .map(([m, amt]) => `${m} $${amt.toLocaleString("zh-TW")}`)
            .join("、");
        const itemLine = summary.items.slice(0, 5)
            .map(([item, count]) => (count > 1 ? `${item}×${count}` : item))
            .join("、");

        await lineService.pushText(userId, [
            `👨‍👩 爸媽消費月報 ${lastMonth}`,
            "━━━━━━━━━━━━",
            `💰 $${summary.total.toLocaleString("zh-TW")}（${summary.count} 筆，佔全家 ${pct}%）`,
            ...momLine,
            "",
            "📊 花在哪：",
            ...tagLines,
            ...(merchantLine ? ["", `🏪 常去：${merchantLine}`] : []),
            ...(itemLine ? [`🛒 常買：${itemLine}`] : []),
        ].join("\n"));

        return NextResponse.json({
            status: "ok",
            month: lastMonth,
            total: summary.total,
            count: summary.count,
            familyShare: pct,
        });
    } catch (error) {
        console.error("[cron-einvoice-monthly-report] Error:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
    }
}
