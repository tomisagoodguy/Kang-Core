import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        await db.collection("archive").doc(id).delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API/archive/DELETE] Error:", error);
        return NextResponse.json({ error: "Failed to delete from archive" }, { status: 500 });
    }
}
