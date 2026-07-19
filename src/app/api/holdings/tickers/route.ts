import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";

/**
 * 供 stock-price-sync GitHub Actions 讀取全站去重後的持股代號清單，
 * CRON_SECRET 驗證，不回傳任何使用者持股數量/成本等個人資料。
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const snapshot = await db.collection("holdings").where("shares", ">", 0).get();
        const seen = new Set<string>();
        const tickers: Array<{ market: string; ticker: string }> = [];
        for (const doc of snapshot.docs) {
            const { market, ticker } = doc.data();
            const key = `${market}_${ticker}`;
            if (!seen.has(key)) {
                seen.add(key);
                tickers.push({ market, ticker });
            }
        }
        return NextResponse.json({ tickers });
    } catch (error) {
        console.error("GET /api/holdings/tickers error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
