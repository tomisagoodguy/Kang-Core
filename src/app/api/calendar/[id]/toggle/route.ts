import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { requireOwnership } from "@/lib/auth/requireOwnership";

export async function POST(
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

        const currentStatus = snap.data()?.status;
        const newStatus = currentStatus === "pending" ? "done" : "pending";

        await snap.ref.update({ status: newStatus });
        return NextResponse.json({ success: true, status: newStatus });
    } catch (error) {
        console.error("[API/calendar/toggle] Error:", error);
        return NextResponse.json({ error: "Failed to toggle status" }, { status: 500 });
    }
}
