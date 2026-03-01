import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const month = searchParams.get("month");
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        let query = db.collection("accounting").orderBy("date", "desc") as FirebaseFirestore.Query;

        // 篩選邏輯
        if (month) {
            // e.g. month=2026-03 → date >= 2026-03-01, date < 2026-04-01
            const [year, mon] = month.split("-").map(Number);
            const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
            const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
            query = query.where("date", ">=", startDate).where("date", "<", nextMonth);
        } else if (from && to) {
            query = query.where("date", ">=", from).where("date", "<=", to);
        } else {
            // 預設當月
            const now = new Date();
            const y = now.getFullYear();
            const m = now.getMonth() + 1;
            const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
            const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
            query = query.where("date", ">=", startDate).where("date", "<", nextMonth);
        }

        const snapshot = await query.get();

        // 建立 CSV
        const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
        const header = "日期,金額,標籤,說明,來源,建立時間";
        const rows = snapshot.docs.map((doc) => {
            const d = doc.data();
            const escapeCsv = (val: string | undefined) => {
                if (!val) return "";
                // 如果值包含逗號或雙引號，需要跳脫
                if (val.includes(",") || val.includes('"') || val.includes("\n")) {
                    return `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            };
            return [
                d.date || "",
                d.amount || 0,
                d.tag || "",
                escapeCsv(d.description),
                d.source || "",
                d.createdAt ? new Date(d.createdAt._seconds * 1000).toISOString() : "",
            ].join(",");
        });

        const csv = BOM + header + "\n" + rows.join("\n");

        const filename = month
            ? `accounting-${month}.csv`
            : from && to
                ? `accounting-${from}-to-${to}.csv`
                : `accounting-${new Date().toISOString().slice(0, 7)}.csv`;

        return new NextResponse(csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error("[API/export/accounting] Error:", error);
        return NextResponse.json({ error: "匯出失敗" }, { status: 500 });
    }
}
