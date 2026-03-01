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

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        const body = await request.json();
        const { title, summary, keywords, url } = body;

        const updateData: Record<string, unknown> = {};
        if (title !== undefined) updateData.title = title;
        if (summary !== undefined) updateData.summary = summary;
        if (keywords !== undefined) updateData.keywords = keywords;
        if (url !== undefined) updateData.url = url;

        await db.collection("archive").doc(id).update(updateData);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API/archive/PUT] Error:", error);
        return NextResponse.json({ error: "Failed to update archive entry" }, { status: 500 });
    }
}
