import { db } from "@/lib/firebase/admin";
import { fetchRateToTWD } from "@/lib/exchangeRate";

export interface NetWorthComputation {
    cashBalance: number;
    investmentValueTWD: number;
    loanBalance: number;
    netWorth: number;
}

/**
 * 淨值計算與快照落地（單一事實來源）
 * 供 /api/net-worth（Dashboard 手動快照）與 /api/cron/net-worth-snapshot（月初自動快照）共用
 */
export class NetWorthService {
    static async compute(userId: string): Promise<NetWorthComputation> {
        const [cashBalance, investmentValueTWD, loanBalance] = await Promise.all([
            this.computeCashBalance(userId),
            this.computeInvestmentValueTWD(userId),
            this.computeLoanBalance(userId),
        ]);
        return {
            cashBalance,
            investmentValueTWD,
            loanBalance,
            netWorth: cashBalance + investmentValueTWD - loanBalance,
        };
    }

    /** 建立快照並回傳寫入內容（date 格式 YYYY-MM-DD） */
    static async createSnapshot(userId: string, date: string) {
        const computation = await this.compute(userId);
        const insertData = {
            userId,
            date,
            ...computation,
            createdAt: new Date(),
        };
        const docRef = await db.collection("net_worth_snapshots").add(insertData);
        return { id: docRef.id, ...insertData };
    }

    /** 該月是否已有快照（避免自動快照與手動快照重複）。快照量小，撈全部後記憶體過濾即可，不需新複合索引 */
    static async hasSnapshotInMonth(userId: string, monthPrefix: string): Promise<boolean> {
        const snapshot = await db.collection("net_worth_snapshots")
            .where("userId", "==", userId)
            .get();
        return snapshot.docs.some((doc) => (doc.data().date as string | undefined)?.startsWith(monthPrefix));
    }

    private static async computeCashBalance(userId: string): Promise<number> {
        const doc = await db.collection("cash_accounts").doc(userId).get();
        return doc.data()?.balance ?? 0;
    }

    private static async computeInvestmentValueTWD(userId: string): Promise<number> {
        const holdingsSnap = await db.collection("holdings").where("userId", "==", userId).get();
        if (holdingsSnap.empty) return 0;

        const usdRate = await fetchRateToTWD("USD");
        let total = 0;
        for (const doc of holdingsSnap.docs) {
            const h = doc.data();
            const price = h.currentPrice ?? h.avgCost ?? 0;
            const marketValue = (h.shares ?? 0) * price;
            total += h.market === "US" ? marketValue * usdRate : marketValue;
        }
        return Math.round(total);
    }

    private static async computeLoanBalance(userId: string): Promise<number> {
        const loansSnap = await db.collection("loans")
            .where("userId", "==", userId)
            .where("status", "==", "active")
            .get();
        return loansSnap.docs.reduce((sum, doc) => sum + (doc.data().remainingPrincipal ?? 0), 0);
    }
}
