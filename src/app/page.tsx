import { StatCard } from "@/components/StatCard";
import { AccountingRow } from "@/components/AccountingRow";
import { ArchiveCard } from "@/components/ArchiveCard";
import { CalendarCard } from "@/components/CalendarCard";
import { ThreadsCard } from "@/components/ThreadsCard";
import Link from "next/link";
import { LayoutDashboard, Coins, CreditCard, Scale, Receipt, BookMarked, CalendarDays, Library, MessageCircle, Inbox } from "lucide-react";
import { db } from "@/lib/firebase/admin";
import { myExpenseTWD } from "@/utils/currency";
import { Timestamp } from "firebase-admin/firestore";
import type { AccountingEntryView, ArchiveEntryView, CalendarEntryView, ThreadsEntryView } from "@/models/schema";


export const dynamic = "force-dynamic";

async function getAccountingEntries(limit = 5): Promise<AccountingEntryView[]> {
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
            } as AccountingEntryView;
        });
    } catch (e) {
        console.error("[HomePage] Failed to fetch accounting:", e);
        return [];
    }
}

import { getUpcomingEventsFromGoogleCalendar } from "@/lib/calendar/client";

async function getCalendarEntries(limit = 10): Promise<CalendarEntryView[]> {
    try {
        // Fetch from Firestore
        const snapshot = await db
            .collection("calendar")
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();

        const firestoreEntries = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt:
                    data.createdAt instanceof Timestamp
                        ? data.createdAt.toDate().toISOString()
                        : null,
            } as CalendarEntryView;
        });

        // Fetch from Google Calendar
        let gcalEvents: Array<{ id: string; summary?: string; description?: string; start?: { dateTime?: string; date?: string } }> = [];
        try {
            gcalEvents = await getUpcomingEventsFromGoogleCalendar(7);
        } catch (e) {
            console.error("[HomePage] Failed to fetch Google Calendar:", e);
        }

        const gcalEntries: CalendarEntryView[] = gcalEvents.map((event) => {
            let actionDate = "";
            let actionTime = "";

            if (event.start?.dateTime) {
                // Set to Asia/Taipei to match app timezone
                const dt = new Date(event.start.dateTime);
                // Convert dt to string
                actionDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                actionTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            } else if (event.start?.date) {
                actionDate = event.start.date;
            }

            return {
                id: `gcal-${event.id}`,
                title: event.summary || "未命名行程",
                description: event.description,
                actionDate,
                actionTime,
                status: "pending",
                gcalEventId: event.id,
                source: "system",
                originalText: "Imported from Google Calendar",
            };
        });

        // Merging logic: Combine and sort by date/time ascending, maybe deduplicate
        // If a firestore item has the same gcalEventId, skip it in GcalEntries or vice versa
        const firestoreGcalIds = new Set(firestoreEntries.map(e => e.gcalEventId).filter(Boolean));
        const filteredGcalEntries = gcalEntries.filter(e => !firestoreGcalIds.has(e.gcalEventId));

        const allEntries = [...firestoreEntries, ...filteredGcalEntries];

        // 取得台灣時間的今天日期字串 (YYYY-MM-DD)
        const d = new Date();
        d.setUTCHours(d.getUTCHours() + 8);
        const todayStr = d.toISOString().split("T")[0];

        // 1. 過濾掉「時間已經過去 (早於今天)」的資料，讓即將到來只顯示未來的
        const upcomingEntries = allEntries.filter(e => {
            if (!e.actionDate) return true; // 特殊沒有日期的就保留
            return e.actionDate >= todayStr;
        });

        // 2. 排序 (未完成排前面，日期小的排前面)
        upcomingEntries.sort((a, b) => {
            if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
            const timeA = new Date(`${a.actionDate || "2099-01-01"}T${a.actionTime || "00:00"}`).getTime();
            const timeB = new Date(`${b.actionDate || "2099-01-01"}T${b.actionTime || "00:00"}`).getTime();
            return timeA - timeB;
        });

        return upcomingEntries.slice(0, limit);
    } catch (e) {
        console.error("[HomePage] Failed to fetch calendar:", e);
        return [];
    }
}

async function getArchiveEntries(limit = 5): Promise<ArchiveEntryView[]> {
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
            } as ArchiveEntryView;
        });
    } catch (e) {
        console.error("[HomePage] Failed to fetch archive:", e);
        return [];
    }
}

async function getThreadsEntries(limit = 6): Promise<ThreadsEntryView[]> {
    try {
        const snapshot = await db
            .collection("threads")
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
            } as ThreadsEntryView;
        });
    } catch (e) {
        console.error("[HomePage] Failed to fetch threads:", e);
        return [];
    }
}

export default async function HomePage() {
    const [accountingEntries, archiveEntries, calendarEntries, threadsEntries] = await Promise.all([
        getAccountingEntries(5),
        getArchiveEntries(5),
        getCalendarEntries(5),
        getThreadsEntries(6),
    ]);

    const currentMonth = new Date().toISOString().slice(0, 7);

    let monthlyIncome = 0;
    let monthlyExpense = 0;
    let monthlyCount = 0;
    let archiveTotalCount = 0;

    try {
        // 獨立撈取當月所有記帳記錄以計算正確的總支出與筆數
        const monthAccSnapshot = await db.collection("accounting")
            .where("date", ">=", `${currentMonth}-01`)
            .where("date", "<=", `${currentMonth}-31`)
            .get();

        const monthDocs = monthAccSnapshot.docs.map(doc => doc.data());
        monthlyIncome = monthDocs.reduce((sum, data) => data.tag === "Income" ? sum + myExpenseTWD(data) : sum, 0);
        monthlyExpense = monthDocs.reduce((sum, data) => data.tag !== "Income" ? sum + myExpenseTWD(data) : sum, 0);
        monthlyCount = monthAccSnapshot.size;
    } catch (e) {
        console.error("[HomePage] Failed to calculate monthly stats:", e);
    }

    try {
        // 取得知識庫總存檔數量
        const archiveCountRes = await db.collection("archive").count().get();
        archiveTotalCount = archiveCountRes.data().count;
    } catch (e) {
        console.error("[HomePage] Failed to count archive:", e);
    }

    const monthlyNet = monthlyIncome - monthlyExpense;

    return (
        <div className="page-container">
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LayoutDashboard size={28} className="text-accent" />
                儀表板
            </h1>
            <p className="page-subtitle">透過 LINE Bot 傳訊息，讓 AI 幫你記錄生活的每一筆帳和知識。</p>

            {/* Stat Cards */}
            <div className="stat-grid">
                <StatCard
                    icon={<Coins size={24} />}
                    label="本月收入"
                    value={`$${monthlyIncome.toLocaleString()}`}
                    color="var(--success)"
                />
                <StatCard
                    icon={<CreditCard size={24} />}
                    label="本月支出"
                    value={`$${monthlyExpense.toLocaleString()}`}
                    color="var(--danger)"
                />
                <StatCard
                    icon={<Scale size={24} />}
                    label="本月結餘"
                    value={`$${monthlyNet.toLocaleString()}`}
                    color={monthlyNet >= 0 ? "var(--success)" : "var(--danger)"}
                />
                <StatCard
                    icon={<Receipt size={24} />}
                    label="本月記帳"
                    value={`${monthlyCount} 筆`}
                    color="var(--warning)"
                />
                <StatCard
                    icon={<BookMarked size={24} />}
                    label="知識庫存檔"
                    value={`${archiveTotalCount} 篇`}
                    color="var(--accent-light)"
                />
            </div>

            {/* Calendar / Todo Section */}
            <div style={{ marginBottom: "40px" }}>
                <div className="dashboard-section-title">
                    <CalendarDays size={18} /> 即將到來 / 代辦事項
                </div>
                {calendarEntries.length === 0 ? (
                    <div className="empty-state">
                        <Inbox size={48} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                        <p>還沒有代辦事項，傳個時間或計劃給機器人吧！</p>
                    </div>
                ) : (
                    <div className="calendar-grid">
                        {calendarEntries.map((entry: CalendarEntryView) => (
                            <CalendarCard key={entry.id} entry={entry} />
                        ))}
                    </div>
                )}
            </div>

            {/* Accounting Section */}
            <div style={{ marginBottom: "40px" }}>
                <div className="dashboard-section-title">
                    <Receipt size={18} /> 最近記帳
                    <Link href="/accounting" style={{ marginLeft: "auto", color: "var(--accent-light)", fontSize: "0.875rem" }}>
                        查看全部 →
                    </Link>
                </div>
                {accountingEntries.length === 0 ? (
                    <div className="empty-state">
                        <Inbox size={48} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                        <p>還沒有記帳記錄，傳訊息給機器人吧！</p>
                    </div>
                ) : (
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-glass)", borderRadius: "12px", overflow: "hidden" }}>
                        {accountingEntries.map((entry: AccountingEntryView, idx) => (
                            <div key={entry.id} style={{ borderTop: idx > 0 ? "1px solid var(--border-glass)" : undefined }}>
                                <AccountingRow entry={entry} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Archive Section */}
            <div style={{ marginBottom: "40px" }}>
                <div className="dashboard-section-title">
                    <Library size={18} /> 最近存檔
                    <Link href="/archive" style={{ marginLeft: "auto", color: "var(--accent-light)", fontSize: "0.875rem" }}>
                        查看全部 →
                    </Link>
                </div>
                {archiveEntries.length === 0 ? (
                    <div className="empty-state">
                        <Inbox size={48} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                        <p>還沒有存檔記錄，傳連結或文章給機器人！</p>
                    </div>
                ) : (
                    <div className="archive-grid">
                        {archiveEntries.map((entry: ArchiveEntryView) => (
                            <ArchiveCard key={entry.id} entry={entry} />
                        ))}
                    </div>
                )}
            </div>

            {/* Threads Section */}
            <div>
                <div className="dashboard-section-title">
                    <MessageCircle size={18} /> 社群洞察
                    <span style={{
                        marginLeft: "8px",
                        fontSize: "0.7rem",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background: "rgba(161,100,255,0.15)",
                        color: "#c084fc",
                        fontWeight: 500,
                    }}>Threads 監控</span>
                    <Link href="/threads" style={{ marginLeft: "auto", color: "var(--accent-light)", fontSize: "0.875rem" }}>
                        查看全部 →
                    </Link>
                </div>
                {threadsEntries.length === 0 ? (
                    <div className="empty-state">
                        <Inbox size={48} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                        <p>啟動 threads-scraper 後，監控的 Threads 貼文將自動出現在這裡。</p>
                    </div>
                ) : (
                    <div className="threads-grid">
                        {threadsEntries.map((entry: ThreadsEntryView) => (
                            <ThreadsCard key={entry.id} entry={entry} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

