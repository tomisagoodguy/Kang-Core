import { StatCard } from "@/components/StatCard";
import { AccountingCard } from "@/components/AccountingCard";
import { ArchiveCard } from "@/components/ArchiveCard";
import Link from "next/link";
import { db } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

async function getAccountingEntries(limit = 5) {
    try {
        const snapshot = await db
            .collection("accounting")
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();

        return snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt:
                    data.createdAt instanceof Timestamp
                        ? data.createdAt.toDate().toISOString()
                        : null,
            };
        });
    } catch (e) {
        console.error("[HomePage] Failed to fetch accounting:", e);
        return [];
    }
}

async function getArchiveEntries(limit = 5) {
    try {
        const snapshot = await db
            .collection("archive")
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();

        return snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt:
                    data.createdAt instanceof Timestamp
                        ? data.createdAt.toDate().toISOString()
                        : null,
            };
        });
    } catch (e) {
        console.error("[HomePage] Failed to fetch archive:", e);
        return [];
    }
}

export default async function HomePage() {
    const [accountingEntries, archiveEntries] = await Promise.all([
        getAccountingEntries(5),
        getArchiveEntries(5),
    ]);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyEntries = accountingEntries.filter((e: any) =>
        e.date?.startsWith(currentMonth)
    );
    const monthlyTotal = monthlyEntries.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

    return (
        <div className="page-container">
            <h1 className="page-title">📊 儀表板</h1>
            <p className="page-subtitle">透過 LINE Bot 傳訊息，讓 AI 幫你記錄生活的每一筆帳和知識。</p>

            {/* Stat Cards */}
            <div className="stat-grid">
                <StatCard
                    icon="💳"
                    label="本月總支出"
                    value={`$${monthlyTotal.toLocaleString()}`}
                    color="var(--danger)"
                />
                <StatCard
                    icon="📝"
                    label="本月記帳筆數"
                    value={monthlyEntries.length}
                    color="var(--warning)"
                />
                <StatCard
                    icon="📚"
                    label="知識庫存檔"
                    value={archiveEntries.length}
                    color="var(--accent-light)"
                />
            </div>

            {/* Accounting Section */}
            <div style={{ marginBottom: "40px" }}>
                <div className="dashboard-section-title">
                    <span>💳</span> 最近記帳
                    <Link href="/accounting" style={{ marginLeft: "auto", color: "var(--accent-light)", fontSize: "0.875rem" }}>
                        查看全部 →
                    </Link>
                </div>
                {accountingEntries.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-state-icon">📭</span>
                        <p>還沒有記帳記錄，傳訊息給機器人吧！</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {accountingEntries.map((entry: any) => (
                            <AccountingCard key={entry.id} entry={entry} />
                        ))}
                    </div>
                )}
            </div>

            {/* Archive Section */}
            <div>
                <div className="dashboard-section-title">
                    <span>📚</span> 最近存檔
                    <Link href="/archive" style={{ marginLeft: "auto", color: "var(--accent-light)", fontSize: "0.875rem" }}>
                        查看全部 →
                    </Link>
                </div>
                {archiveEntries.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-state-icon">📭</span>
                        <p>還沒有存檔記錄，傳連結或文章給機器人！</p>
                    </div>
                ) : (
                    <div className="archive-grid">
                        {archiveEntries.map((entry: any) => (
                            <ArchiveCard key={entry.id} entry={entry} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
