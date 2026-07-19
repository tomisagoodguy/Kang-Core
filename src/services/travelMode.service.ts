import { db } from "@/lib/firebase/admin";
import { currencyForDestination, myExpenseTWD } from "@/utils/currency";
import { fetchRateToTWD } from "@/lib/exchangeRate";
import type { AccountingEntry, Trip } from "@/models/schema";

export interface TravelModeState {
    active: boolean;
    destination: string | null;
    startedAt: Date | null;
    /** 旅遊當地幣別（由目的地推斷，null 視為台幣） */
    currency: string | null;
    /** 啟動時抓取的匯率（1 外幣 = ? 台幣），整趟沿用 */
    exchangeRate: number | null;
}

export interface YearlyTravelStats {
    year: number;
    /** 全年 Travel 標籤支出加總（台幣），含旅程期間外的機票、簽證等 */
    totalTWD: number;
    /** 該年度已結束的旅程（依出發日排序） */
    trips: Trip[];
    /** 年度旅遊預算，未設定為 null */
    budget: number | null;
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

    /** 關閉旅遊模式；若原本為開啟狀態則落地一筆 trips 紀錄並回傳（供回覆總結用） */
    static async deactivate(userId: string): Promise<Trip | null> {
        const prev = await this.getState(userId);

        let trip: Trip | null = null;
        if (prev.active && prev.startedAt) {
            const startDate = prev.startedAt.toISOString().slice(0, 10);
            const endDate = new Date().toISOString().slice(0, 10);
            const days = Math.max(1, Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1);
            const totalTWD = await this.sumTravelSpendTWD(userId, startDate, endDate);
            trip = {
                userId,
                destination: prev.destination,
                startDate,
                endDate,
                days,
                totalTWD,
                currency: prev.currency,
                createdAt: new Date(),
            };
            const ref = await db.collection("trips").add(trip);
            trip.id = ref.id;
        }

        const state: TravelModeState = {
            active: false, destination: null, startedAt: null, currency: null, exchangeRate: null,
        };
        await db.collection("user_settings").doc(userId).set({ travelMode: state }, { merge: true });
        this.cache.set(userId, state);
        return trip;
    }

    /** 期間內 Travel 標籤支出加總（換算台幣、代墊只計自己份額） */
    static async sumTravelSpendTWD(userId: string, from: string, to: string): Promise<number> {
        const snap = await db.collection("accounting")
            .where("userId", "==", userId)
            .where("date", ">=", from)
            .where("date", "<=", to)
            .get();
        return snap.docs
            .map((d) => d.data() as AccountingEntry)
            .filter((e) => e.tag === "Travel")
            .reduce((s, e) => s + myExpenseTWD(e), 0);
    }

    /** 年度旅遊預算（存於 user_settings.annualTravelBudget，未設定回 null） */
    static async getAnnualTravelBudget(userId: string): Promise<number | null> {
        const doc = await db.collection("user_settings").doc(userId).get();
        return doc.data()?.annualTravelBudget ?? null;
    }

    static async setAnnualTravelBudget(userId: string, amount: number): Promise<void> {
        await db.collection("user_settings").doc(userId).set({ annualTravelBudget: amount }, { merge: true });
    }

    /**
     * 年度旅遊統計：全年 Travel 支出（含旅程外的機票、簽證等）、
     * 已結束旅程列表、年度預算。
     */
    static async getYearlyTravelStats(userId: string, year?: number): Promise<YearlyTravelStats> {
        const y = year ?? new Date().getFullYear();
        const [totalTWD, tripsSnap, budget] = await Promise.all([
            this.sumTravelSpendTWD(userId, `${y}-01-01`, `${y}-12-31`),
            db.collection("trips").where("userId", "==", userId).get(),
            this.getAnnualTravelBudget(userId),
        ]);
        const trips = tripsSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Trip))
            .filter((t) => t.startDate.startsWith(String(y)))
            .sort((a, b) => a.startDate.localeCompare(b.startDate));
        return { year: y, totalTWD, trips, budget };
    }

    /** 從訊息中提取目的地名稱 */
    static extractDestination(text: string): string | null {
        return DESTINATION_KEYWORDS.find(kw => text.includes(kw)) ?? null;
    }
}
