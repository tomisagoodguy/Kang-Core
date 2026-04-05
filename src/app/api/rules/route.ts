import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

const RuleSchema = z.object({
    keyword: z.string(),
    tag: z.string(),
    subTag: z.string().optional().nullable(),
});

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const snapshot = await db.collection("classification_rules")
            .where("userId", "==", userId)
            .orderBy("lastUsed", "desc")
            .get();
        const rules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(rules);
    } catch {
        return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const body = await req.json();
        const validated = RuleSchema.parse(body);

        const docRef = await db.collection("classification_rules").add({
            ...validated,
            userId,
            count: 0,
            lastUsed: new Date(),
            createdAt: new Date()
        });

        return NextResponse.json({ id: docRef.id, ...validated });
    } catch {
        return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
}
