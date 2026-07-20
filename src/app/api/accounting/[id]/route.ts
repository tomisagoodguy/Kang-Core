import { NextRequest, NextResponse } from "next/server";
import { ClassificationEngine } from "@/services/classificationEngine";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { requireOwnership } from "@/lib/auth/requireOwnership";

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getSessionUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await context.params;
        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        const snap = await requireOwnership("accounting", id, userId);
        if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

        await snap.ref.delete();
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
        const userId = await getSessionUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await context.params;
        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        const snap = await requireOwnership("accounting", id, userId);
        if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const body = await request.json();
        const { amount, tag, subTag, date, description, paymentMethod, creditCardId } = body;

        const updateData: Record<string, unknown> = {};
        if (amount !== undefined) {
            const newAmount = Number(amount);
            updateData.amount = newAmount;
            // 同步重算台幣金額（沿用原匯率），避免統計用到舊的 amountTWD
            const rate = (snap.data()?.exchangeRate as number) ?? 1;
            updateData.amountTWD = Math.round(newAmount * rate);
        }
        if (tag !== undefined) updateData.tag = tag;
        if (subTag !== undefined) updateData.subTag = subTag;
        if (date !== undefined) updateData.date = date;
        if (description !== undefined) updateData.description = description;
        if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
        if (creditCardId !== undefined) updateData.creditCardId = creditCardId;

        await snap.ref.update(updateData);

        if (tag !== undefined && description) {
            ClassificationEngine.learn(description, tag, userId, subTag, true).catch(() => {});
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API/accounting/PUT] Error:", error);
        return NextResponse.json({ error: "Failed to update accounting entry" }, { status: 500 });
    }
}
