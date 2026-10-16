import { NextResponse } from "next/server";
import { LoanSchema } from "@/models/schema";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { requireOwnership } from "@/lib/auth/requireOwnership";
import { pickProvidedFields } from "@/utils/partialUpdate";

const UpdateLoanSchema = LoanSchema.omit({ id: true, createdAt: true, userId: true }).partial();

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const userId = await getSessionUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const snap = await requireOwnership("loans", id, userId);
        if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const body = await request.json();
        const result = UpdateLoanSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid input", details: result.error.format() },
                { status: 400 }
            );
        }

        const updates = pickProvidedFields(result.data, body);
        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
        }
        await snap.ref.update(updates);
        return NextResponse.json({ id, ...updates });
    } catch (error) {
        console.error("PUT /api/loans/[id] error:", error);
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

        const snap = await requireOwnership("loans", id, userId);
        if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

        await snap.ref.delete();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/loans/[id] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
