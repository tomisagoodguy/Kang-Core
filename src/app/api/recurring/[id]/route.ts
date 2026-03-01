import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { RecurringExpenseSchema } from "@/models/schema";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const body = await request.json();

        const PartialSchema = RecurringExpenseSchema.partial();
        const result = PartialSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid input", details: result.error.format() },
                { status: 400 }
            );
        }

        const docRef = db.collection("recurring_expenses").doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        await docRef.update(result.data);

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
        const docRef = db.collection("recurring_expenses").doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        await docRef.delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/recurring/[id] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
