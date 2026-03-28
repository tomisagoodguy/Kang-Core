import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

/**
 * 預算 CRUD
 * GET  /api/budget        — 查詢所有預算
 * POST /api/budget        — 新增或更新預算（依 tag 唯一）
 * DELETE /api/budget?id=  — 刪除預算
 *
 * 此 API 供 Web Dashboard 使用，LINE Bot 透過指令觸發
 */

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const snap = await db.collection("budgets")
            .where("userId", "==", userId)
            .get();
        const budgets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return NextResponse.json({ budgets });
    } catch (err) {
        console.error("[budget] GET error:", err);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const body = await req.json() as { tag?: string; monthlyLimit: number };
        const { tag, monthlyLimit } = body;

        if (!monthlyLimit || monthlyLimit <= 0) {
            return NextResponse.json({ error: "monthlyLimit 必須大於 0" }, { status: 400 });
        }

        // 查詢是否已存在同 tag 的預算（tag 為 null/undefined 代表總預算）
        let query = db.collection("budgets").where("userId", "==", userId) as FirebaseFirestore.Query;
        if (tag) {
            query = query.where("tag", "==", tag);
        } else {
            query = query.where("tag", "==", null);
        }

        const existing = await query.get();

        if (!existing.empty) {
            await existing.docs[0].ref.update({ monthlyLimit, updatedAt: new Date() });
        } else {
            await db.collection("budgets").add({
                userId,
                tag: tag ?? null,
                monthlyLimit,
                createdAt: new Date(),
            });
        }

        const tagLabel = tag ? `「${tag}」` : "總";
        return NextResponse.json({ message: `${tagLabel}預算已設定為 $${monthlyLimit}` });
    } catch (err) {
        console.error("[budget] POST error:", err);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "缺少 id 參數" }, { status: 400 });
        }

        // 驗證此 budget 屬於當前用戶
        const doc = await db.collection("budgets").doc(id).get();
        if (!doc.exists || doc.data()?.userId !== userId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        await db.collection("budgets").doc(id).delete();
        return NextResponse.json({ message: "預算已刪除" });
    } catch (err) {
        console.error("[budget] DELETE error:", err);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
