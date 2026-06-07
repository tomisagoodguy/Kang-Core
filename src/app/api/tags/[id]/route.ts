import { NextResponse } from "next/server";
import { CustomTagSchema } from "@/models/schema";
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

        const snap = await requireOwnership("custom_tags", id, userId);
        if (!snap) return NextResponse.json({ error: "Tag not found" }, { status: 404 });

        const body = await request.json();
        const result = CustomTagSchema.partial().safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: "Invalid data", details: result.error.format() }, { status: 400 });
        }

        await snap.ref.update(result.data);
        return NextResponse.json({ id, ...result.data });
    } catch (error) {
        console.error("PUT /api/tags/[id] error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

        const snap = await requireOwnership("custom_tags", id, userId);
        if (!snap) return NextResponse.json({ error: "Tag not found" }, { status: 404 });

        await snap.ref.delete();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/tags/[id] error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
