import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { requireOwnership } from "@/lib/auth/requireOwnership";

const RuleUpdateSchema = z.object({
    keyword: z.string().optional(),
    tag: z.string().optional(),
    subTag: z.string().optional().nullable(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const userId = await getSessionUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const snap = await requireOwnership("classification_rules", id, userId);
        if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const body = await req.json();
        const result = RuleUpdateSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 });
        }

        await snap.ref.update(result.data);
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const userId = await getSessionUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const snap = await requireOwnership("classification_rules", id, userId);
        if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

        await snap.ref.delete();
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
