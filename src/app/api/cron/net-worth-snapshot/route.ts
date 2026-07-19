import { NextResponse } from "next/server";
import { getAllLineUserIds } from "@/lib/userRegistry";
import { NetWorthService } from "@/services/netWorth.service";

/**
 * 每月 1 日自動記錄淨值快照（TWR / 淨值趨勢的時間序列基礎）
 * Vercel Cron: 30 1 1 * * (UTC) -> 台灣時間每月 1 日 09:30
 * 若該月已有快照（例如使用者當天手動按過）則跳過，不重複落地
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIds = getAllLineUserIds();
    if (userIds.length === 0) {
        return NextResponse.json({ error: "LINE_USER_IDS not set" }, { status: 500 });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const monthPrefix = todayStr.slice(0, 7);
    const results: Array<{ userId: string; status: "created" | "skipped" | "error" }> = [];

    for (const userId of userIds) {
        try {
            if (await NetWorthService.hasSnapshotInMonth(userId, monthPrefix)) {
                results.push({ userId, status: "skipped" });
                continue;
            }
            await NetWorthService.createSnapshot(userId, todayStr);
            results.push({ userId, status: "created" });
        } catch (error) {
            console.error(`[net-worth-snapshot] failed for ${userId}:`, error);
            results.push({ userId, status: "error" });
        }
    }

    return NextResponse.json({ date: todayStr, results });
}
