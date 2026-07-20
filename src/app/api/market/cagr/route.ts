import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

/**
 * 查詢股票/ETF 歷史年化報酬率（CAGR），供資產頁「複利試算」自動帶入歷史報酬率。
 * 資料來源：Yahoo Finance 公開 chart API（免金鑰），失敗時前端會退回手動輸入年化報酬率。
 * 台股以 `{代號}.TW` 查詢（上市股票/ETF 適用，上櫃股票需自行查證代號後綴）。
 * 需登入才可查詢，避免此路由被當作匿名代理打 Yahoo Finance。
 */
export async function GET(request: NextRequest) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const market = searchParams.get("market");
    const ticker = searchParams.get("ticker")?.trim();
    const years = Number(searchParams.get("years") ?? "10");

    if (!ticker || (market !== "TW" && market !== "US")) {
        return NextResponse.json({ error: "缺少 ticker 或 market 參數" }, { status: 400 });
    }

    const symbol = market === "TW" ? `${ticker}.TW` : ticker;

    try {
        const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=max&interval=1mo`,
            { next: { revalidate: 86400 } } // 歷史股價變動慢，快取一天
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const result = data?.chart?.result?.[0];
        const timestamps: number[] | undefined = result?.timestamp;
        // 用 adjclose（還原股價）而非 close：close 未還原減資/分割，例如 0050 2025 年拆分會讓
        // 未還原價格出現不連續跳空，使 CAGR 嚴重失真
        const closes: (number | null)[] | undefined = result?.indicators?.adjclose?.[0]?.adjclose;

        if (!timestamps?.length || !closes?.length) {
            throw new Error("查無歷史股價資料");
        }

        // 找出最新一筆有效收盤價
        let latestIdx = closes.length - 1;
        while (latestIdx >= 0 && (closes[latestIdx] == null)) latestIdx--;
        if (latestIdx < 0) throw new Error("查無有效收盤價");

        const latestPrice = closes[latestIdx] as number;
        const latestTs = timestamps[latestIdx];
        const targetTs = latestTs - years * 365.25 * 86400;

        // 找出最接近 targetTs 且不晚於它的一筆有效收盤價（不足年數則用最早一筆）
        let startIdx = 0;
        for (let i = 0; i < timestamps.length; i++) {
            if (timestamps[i] <= targetTs && closes[i] != null) startIdx = i;
        }
        while (startIdx < latestIdx && closes[startIdx] == null) startIdx++;

        const startPrice = closes[startIdx] as number;
        const startTs = timestamps[startIdx];
        const actualYears = (latestTs - startTs) / (365.25 * 86400);

        if (!startPrice || startPrice <= 0 || actualYears < 0.5) {
            throw new Error("資料期間過短，無法計算年化報酬率");
        }

        const cagr = Math.pow(latestPrice / startPrice, 1 / actualYears) - 1;

        return NextResponse.json({
            symbol,
            startPrice,
            latestPrice,
            actualYears: Math.round(actualYears * 10) / 10,
            cagrPct: Math.round(cagr * 1000) / 10, // 到小數點後一位的百分比
        });
    } catch (err) {
        console.warn(`[market/cagr] ${symbol} 查詢失敗:`, err);
        return NextResponse.json({ error: "查無此代號的歷史股價資料，請手動輸入年化報酬率" }, { status: 502 });
    }
}
