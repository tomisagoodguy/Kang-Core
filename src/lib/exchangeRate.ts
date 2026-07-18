/**
 * 匯率取得：以免金鑰的 open.er-api.com 抓取「1 外幣 = ? 台幣」。
 * 旅遊模式啟動時抓一次並快取在 user_settings，記帳時直接沿用。
 * API 失敗時退回靜態近似匯率，確保旅遊模式啟動不被外部服務拖垮。
 */

/** 靜態近似匯率（1 外幣 = X 台幣），僅作 API 失敗時的兜底 */
const FALLBACK_RATES: Record<string, number> = {
    USD: 32.5,
    JPY: 0.21,
    EUR: 35,
    KRW: 0.024,
    THB: 0.9,
    GBP: 41,
    HKD: 4.2,
    SGD: 24,
    CNY: 4.5,
    AUD: 21,
    VND: 0.0013,
    CZK: 1.5,
};

/**
 * 取得「1 單位外幣 = 多少台幣」。
 * @param currency ISO 4217 代碼（TWD 直接回 1）
 */
export async function fetchRateToTWD(currency: string): Promise<number> {
    if (!currency || currency === "TWD") return 1;

    try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`, {
            // 匯率變動慢，快取 6 小時減少外呼
            next: { revalidate: 21600 },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
        const rate = data?.rates?.TWD;
        if (data.result !== "success" || typeof rate !== "number" || rate <= 0) {
            throw new Error("匯率回應格式異常");
        }
        return rate;
    } catch (err) {
        console.warn(`[exchangeRate] ${currency} 抓取失敗，改用 fallback:`, err);
        return FALLBACK_RATES[currency] ?? 1;
    }
}
