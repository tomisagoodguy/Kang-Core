import { db } from "@/lib/firebase/admin";
import { currencyForDestination } from "@/utils/currency";
import { fetchRateToTWD } from "@/lib/exchangeRate";

export interface TravelModeState {
    active: boolean;
    destination: string | null;
    startedAt: Date | null;
    /** 旅遊當地幣別（由目的地推斷，null 視為台幣） */
    currency: string | null;
    /** 啟動時抓取的匯率（1 外幣 = ? 台幣），整趟沿用 */
    exchangeRate: number | null;
}

// 不受旅遊模式影響的固定支出標籤
export const NON_TRAVEL_TAGS = new Set(["Income", "Utilities", "Insurance", "Subscription", "Investment", "Loan"]);

// 常見目的地關鍵字，用於從啟動訊息中提取地名
export const DESTINATION_KEYWORDS = [
    "日本", "德國", "美國", "英國", "法國", "韓國", "泰國", "新加坡", "馬來西亞",
    "香港", "澳門", "澳洲", "紐西蘭", "加拿大", "義大利", "西班牙", "荷蘭",
    "瑞士", "葡萄牙", "越南", "印尼", "菲律賓", "印度", "土耳其", "希臘",
    "奧地利", "捷克",
    "東京", "大阪", "京都", "名古屋", "福岡", "北海道", "沖繩",
    "柏林", "慕尼黑", "法蘭克福", "漢堡",
    "維也納", "薩爾斯堡", "哈修塔特", "布拉格", "庫倫洛夫",
    "首爾", "釜山", "濟州",
    "曼谷", "清邁", "清萊", "芭達雅",
    "倫敦", "巴黎", "紐約", "洛杉磯", "舊金山", "羅馬", "米蘭", "巴塞隆納",
    "峇里島", "吉隆坡", "胡志明市", "河內", "曼谷",
];

export class TravelModeService {
    private static cache = new Map<string, TravelModeState>();

    static async getState(userId: string): Promise<TravelModeState> {
        if (this.cache.has(userId)) return this.cache.get(userId)!;

        const doc = await db.collection("user_settings").doc(userId).get();
        const data = doc.data();
        const state: TravelModeState = {
            active: data?.travelMode?.active ?? false,
            destination: data?.travelMode?.destination ?? null,
            startedAt: data?.travelMode?.startedAt?.toDate?.() ?? null,
            currency: data?.travelMode?.currency ?? null,
            exchangeRate: data?.travelMode?.exchangeRate ?? null,
        };
        this.cache.set(userId, state);
        return state;
    }

    static async activate(userId: string, destination?: string): Promise<TravelModeState> {
        // 由目的地推斷幣別，並抓一次當天匯率（整趟沿用）
        const currency = currencyForDestination(destination);
        const exchangeRate = currency ? await fetchRateToTWD(currency) : null;

        const state: TravelModeState = {
            active: true,
            destination: destination ?? null,
            startedAt: new Date(),
            currency,
            exchangeRate,
        };
        await db.collection("user_settings").doc(userId).set(
            { travelMode: { ...state, startedAt: state.startedAt } },
            { merge: true }
        );
        this.cache.set(userId, state);
        return state;
    }

    static async deactivate(userId: string): Promise<void> {
        const state: TravelModeState = {
            active: false, destination: null, startedAt: null, currency: null, exchangeRate: null,
        };
        await db.collection("user_settings").doc(userId).set({ travelMode: state }, { merge: true });
        this.cache.set(userId, state);
    }

    /** 從訊息中提取目的地名稱 */
    static extractDestination(text: string): string | null {
        return DESTINATION_KEYWORDS.find(kw => text.includes(kw)) ?? null;
    }
}
