import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/auth/withAuth";
import type { EinvoiceRecordView } from "@/models/schema";

/**
 * GET /api/einvoice?month=YYYY-MM
 * 家庭電子發票列表（獨立於個人 accounting）。未帶 month 預設當月。
 */
export const GET = withAuth(async (req, userId) => {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const month = searchParams.get("month")
        || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (!/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json({ error: "month 格式須為 YYYY-MM" }, { status: 400 });
    }

    const snap = await db.collection("einvoice_records")
        .where("userId", "==", userId)
        .where("date", ">=", `${month}-01`)
        .where("date", "<=", `${month}-31`)
        .orderBy("date", "desc")
        .get();

    const records: EinvoiceRecordView[] = snap.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            userId: data.userId,
            invoiceNumber: data.invoiceNumber,
            date: data.date,
            merchantName: data.merchantName,
            sellerTaxId: data.sellerTaxId,
            amount: data.amount,
            tag: data.tag,
            description: data.description,
            member: data.member ?? null,
            memberSource: data.memberSource,
            matchedAccountingEntryId: data.matchedAccountingEntryId,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.(),
        };
    });

    return NextResponse.json({ month, records });
});
