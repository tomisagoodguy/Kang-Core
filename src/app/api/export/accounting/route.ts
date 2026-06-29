import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

export async function GET(req: NextRequest) {
    try {
        const userId = await getSessionUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = req.nextUrl;
        const month = searchParams.get("month");
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        let query = db
            .collection("accounting")
            .where("userId", "==", userId)
            .orderBy("date", "desc") as FirebaseFirestore.Query;

        if (month) {
            const [year, mon] = month.split("-").map(Number);
            const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
            const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
            query = query.where("date", ">=", startDate).where("date", "<", nextMonth);
        } else if (from && to) {
            query = query.where("date", ">=", from).where("date", "<=", to);
        } else {
            const now = new Date();
            const y = now.getFullYear();
            const m = now.getMonth() + 1;
            const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
            const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
            query = query.where("date", ">=", startDate).where("date", "<", nextMonth);
        }

        const snapshot = await query.get();

        const BOM = "﻿";
        const header = "日期,金額,幣別,台幣金額,標籤,說明,來源,建立時間";
        const rows = snapshot.docs.map((doc) => {
            const d = doc.data();
            const escapeCsv = (val: string | undefined) => {
                if (!val) return "";
                // 防止 CSV 公式注入：前置單引號阻止 Excel/Sheets 執行 =、+、-、@ 開頭的公式
                let v = val;
                if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
                if (v.includes(",") || v.includes('"') || v.includes("\n")) {
                    return `"${v.replace(/"/g, '""')}"`;
                }
                return v;
            };
            return [
                d.date || "",
                d.amount || 0,
                d.currency || "TWD",
                d.amountTWD ?? d.amount ?? 0,
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
