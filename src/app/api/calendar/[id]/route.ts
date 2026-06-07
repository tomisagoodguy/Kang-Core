import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { deleteEventFromGoogleCalendar } from "@/lib/calendar/client";
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

        const snap = await requireOwnership("calendar", id, userId);
        if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const gcalEventId = snap.data()?.gcalEventId;
        if (gcalEventId) {
            await deleteEventFromGoogleCalendar(gcalEventId);
        }
        await snap.ref.delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API/calendar/DELETE] Error:", error);
        return NextResponse.json({ error: "Failed to delete calendar entry" }, { status: 500 });
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

        const snap = await requireOwnership("calendar", id, userId);
        if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const body = await request.json();
        const { title, actionDate, actionTime, description } = body;

        const updateData: Record<string, unknown> = {};
        if (title !== undefined) updateData.title = title;
        if (actionDate !== undefined) updateData.actionDate = actionDate;
        if (actionTime !== undefined) updateData.actionTime = actionTime;
        if (description !== undefined) updateData.description = description;

        await snap.ref.update(updateData);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API/calendar/PUT] Error:", error);
        return NextResponse.json({ error: "Failed to update calendar entry" }, { status: 500 });
    }
}
