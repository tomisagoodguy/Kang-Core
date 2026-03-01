import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { deleteEventFromGoogleCalendar } from "@/lib/calendar/client";

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        const docRef = db.collection("calendar").doc(id);
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data();
            if (data?.gcalEventId) {
                await deleteEventFromGoogleCalendar(data.gcalEventId);
            }
        }
        await docRef.delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API/calendar/DELETE] Error:", error);
        return NextResponse.json({ error: "Failed to delete calendar entry" }, { status: 500 });
    }
}
