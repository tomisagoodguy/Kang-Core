import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { CustomTagSchema } from "@/models/schema";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const body = await request.json();
        const result = CustomTagSchema.partial().safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: "Invalid data", details: result.error.format() }, { status: 400 });
        }

        const docRef = db.collection("custom_tags").doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Tag not found" }, { status: 404 });
        }

        await docRef.update(result.data);
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
        const docRef = db.collection("custom_tags").doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Tag not found" }, { status: 404 });
        }

        await docRef.delete();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/tags/[id] error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
