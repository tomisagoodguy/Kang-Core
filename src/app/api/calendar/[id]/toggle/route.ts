import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        const docRef = db.collection("calendar").doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const currentStatus = docSnap.data()?.status;
        const newStatus = currentStatus === "pending" ? "done" : "pending";

        await docRef.update({ status: newStatus });

        return NextResponse.json({ success: true, status: newStatus });
    } catch (error) {
        console.error("[API/calendar/toggle] Error:", error);
        return NextResponse.json({ error: "Failed to toggle status" }, { status: 500 });
    }
}
