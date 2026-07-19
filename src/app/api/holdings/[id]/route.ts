import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { requireOwnership } from "@/lib/auth/requireOwnership";
import { z } from "zod";

const UpdatePriceSchema = z.object({
    currentPrice: z.number().positive(),
    priceAsOf: z.string().optional(), // YYYY-MM-DD，預設今天
});

/** 手動更新持股現價（finlab 尚未同步或該代號不在其涵蓋範圍時使用） */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const userId = await getSessionUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const snap = await requireOwnership("holdings", id, userId);
        if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const body = await request.json();
        const result = UpdatePriceSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid input", details: result.error.format() },
                { status: 400 }
            );
        }

        const priceAsOf = result.data.priceAsOf ?? new Date().toISOString().slice(0, 10);
        await snap.ref.update({ currentPrice: result.data.currentPrice, priceAsOf });

        return NextResponse.json({ id, currentPrice: result.data.currentPrice, priceAsOf });
    } catch (error) {
        console.error("PUT /api/holdings/[id] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const userId = await getSessionUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const snap = await requireOwnership("holdings", id, userId);
        if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

        await snap.ref.delete();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/holdings/[id] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
