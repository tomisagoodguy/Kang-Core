import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { z } from "zod";

const PriceItemSchema = z.object({
    market: z.enum(["TW", "US"]),
    ticker: z.string(),
    price: z.number().positive(),
    asOfDate: z.string(),
});

const BodySchema = z.object({
    prices: z.array(PriceItemSchema),
});

/**
 * 接收 services/stock-price-sync 每日推送的收盤價，寫入 market_prices 並批次更新相符 holdings。
 * CRON_SECRET 驗證，比照 threads-scraper 的 push 架構，不讓 GitHub Actions 持有 Firebase 憑證。
 */
export async function POST(req: Request) {
    const authHeader = req.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const result = BodySchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid input", details: result.error.format() },
                { status: 400 }
            );
        }

        let updatedHoldings = 0;

        for (const { market, ticker, price, asOfDate } of result.data.prices) {
            await db.collection("market_prices").doc(`${market}_${ticker}`).set({
                market,
                ticker,
                price,
                asOfDate,
                updatedAt: new Date(),
            }, { merge: true });

            const holdingsSnap = await db.collection("holdings")
                .where("market", "==", market)
                .where("ticker", "==", ticker)
                .get();

            const batch = db.batch();
            holdingsSnap.docs.forEach((doc) => {
                batch.update(doc.ref, { currentPrice: price, priceAsOf: asOfDate });
            });
            if (!holdingsSnap.empty) {
                await batch.commit();
                updatedHoldings += holdingsSnap.size;
            }
        }

        return NextResponse.json({ status: "ok", pricesReceived: result.data.prices.length, holdingsUpdated: updatedHoldings });
    } catch (error) {
        console.error("POST /api/webhook/stock-prices error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
