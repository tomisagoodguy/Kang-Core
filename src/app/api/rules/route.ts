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
        // 排序在 JS 端做：where + orderBy 需要複合索引，此集合每用戶量小
        const snapshot = await db.collection("classification_rules")
            .where("userId", "==", userId)
            .get();
        const ts = (v: unknown) => (v as { toMillis?: () => number })?.toMillis?.() ?? (v ? new Date(v as string).getTime() : 0);
        const rules = snapshot.docs
            .sort((a, b) => ts(b.data().lastUsed) - ts(a.data().lastUsed))
            .map(doc => ({ id: doc.id, ...doc.data() }));
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
