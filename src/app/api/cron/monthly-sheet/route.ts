import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { lineService } from "@/services/line.service";
import { exportToSheet, SheetRow } from "@/lib/sheets/client";
import { myExpenseTWD } from "@/utils/currency";

/**
 * 月底帳目 Export 到 Google Sheets
 * Vercel Cron: 0 15 28-31 * * (UTC) → 每月 28-31 日 UTC 15:00（台灣 23:00）
 * 實際只在當月最後一天執行（在程式內部判斷）
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = process.env.LINE_USER_ID;
    if (!userId) {
        return NextResponse.json({ error: "LINE_USER_ID not set" }, { status: 500 });
    }

    try {
        const now = new Date();
        const twNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
        const year = twNow.getFullYear();
        const month = twNow.getMonth() + 1;

        // 確認今天是當月最後一天（避免 28-31 號都執行）
        // 加 ?force=true 可跳過日期判斷（手動測試用）
        const force = new URL(req.url).searchParams.get("force") === "true";
        const lastDayOfMonth = new Date(year, month, 0).getDate();
        if (!force && twNow.getDate() !== lastDayOfMonth) {
            return NextResponse.json({ status: "skipped", reason: "Not last day of month" });
        }

        const ym = `${year}-${String(month).padStart(2, "0")}`;
        const monthStart = `${ym}-01`;
        const monthEnd = `${ym}-${String(lastDayOfMonth).padStart(2, "0")}`;

        // 查詢當月所有帳目（管理員專屬）
        const snap = await db.collection("accounting")
            .where("userId", "==", userId)
            .where("date", ">=", monthStart)
            .where("date", "<=", monthEnd)
            .orderBy("date", "asc")
            .get();

        if (snap.empty) {
            await lineService.pushText(userId, `📊 ${ym} 月無任何帳目，跳過匯出`);
            return NextResponse.json({ status: "ok", rows: 0 });
        }

        const rows: SheetRow[] = snap.docs.map(d => {
            const data = d.data();
            return {
                date: data.date as string,
                amount: data.amount as number,
                tag: data.tag as string,
                subTag: data.subTag as string | undefined,
                description: data.description as string | undefined,
                source: data.source as string,
            };
        });

        // 計算月合計（換算台幣，代墊只計自己份額）
        const total = snap.docs.reduce((s, d) => s + myExpenseTWD(d.data()), 0);

        // 匯出到 Google Sheets
        const sheetsUrl = await exportToSheet(ym, rows);

        await lineService.pushText(userId, [
            `📊 ${ym} 月帳目已匯出`,
            "━━━━━━━━━━━━",
            `📝 共 ${rows.length} 筆`,
            `💰 月合計 $${total.toLocaleString()}`,
            "",
            "🔗 Google Sheets 已更新",
            sheetsUrl,
        ].join("\n"));

        return NextResponse.json({ status: "ok", rows: rows.length, total });
    } catch (err) {
        console.error("[monthly-sheet] Error:", err);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
