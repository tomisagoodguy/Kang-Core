import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
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
