import { NextResponse } from "next/server";
import { RecurringExpenseSchema } from "@/models/schema";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { requireOwnership } from "@/lib/auth/requireOwnership";

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

        await snap.ref.update(result.data);
        return NextResponse.json({ id, ...result.data });
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
