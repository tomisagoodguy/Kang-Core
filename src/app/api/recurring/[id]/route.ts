import { NextResponse } from "next/server";
import { RecurringExpenseSchema } from "@/models/schema";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { requireOwnership } from "@/lib/auth/requireOwnership";

const IMMUTABLE_FIELDS = new Set(["id", "userId", "createdAt", "source", "originalText"]);

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const userId = await getSessionUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const snap = await requireOwnership("recurring_expenses", id, userId);
        if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const body = await request.json();
        const PartialSchema = RecurringExpenseSchema.partial();
        const result = PartialSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid input", details: result.error.format() },
                { status: 400 }
            );
        }

        // 只寫入 body 實際帶的欄位：Zod 4 的 partial() 仍會套用 default（例如 source="line"），
        // 不過濾會在切換啟用狀態時蓋掉原本的值；userId 等歸屬欄位一律不允許由前端修改
        const updates = Object.fromEntries(
            Object.entries(result.data).filter(([key]) => key in body && !IMMUTABLE_FIELDS.has(key))
        );

        await snap.ref.update(updates);
        return NextResponse.json({ id, ...updates });
    } catch (error) {
        console.error("PUT /api/recurring/[id] error:", error);
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

        const snap = await requireOwnership("recurring_expenses", id, userId);
        if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

        await snap.ref.delete();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/recurring/[id] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
