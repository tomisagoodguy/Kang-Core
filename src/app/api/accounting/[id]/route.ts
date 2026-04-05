import { NextRequest, NextResponse } from "next/server";
import { ClassificationEngine } from "@/services/classificationEngine";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        await db.collection("accounting").doc(id).delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API/accounting/DELETE] Error:", error);
        return NextResponse.json({ error: "Failed to delete from accounting" }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        const body = await request.json();
        const { amount, tag, subTag, date, description } = body;

        const updateData: Record<string, unknown> = {};
        if (amount !== undefined) updateData.amount = Number(amount);
        if (tag !== undefined) updateData.tag = tag;
        if (subTag !== undefined) updateData.subTag = subTag;
        if (date !== undefined) updateData.date = date;
        if (description !== undefined) updateData.description = description;

        await db.collection("accounting").doc(id).update(updateData);

        // Tag 修改時，觸發分類規則學習（使用者的修正即是最高品質的訓練訊號）
        if (tag !== undefined && description) {
            const userId = await getSessionUserId();
            if (userId) {
                ClassificationEngine.learn(description, tag, userId, subTag, true).catch(() => {
                    // 非關鍵路徑，不影響主流程
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API/accounting/PUT] Error:", error);
        return NextResponse.json({ error: "Failed to update accounting entry" }, { status: 500 });
    }
}
