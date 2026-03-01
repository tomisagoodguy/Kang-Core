import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { z } from "zod";

const RuleSchema = z.object({
    keyword: z.string(),
    tag: z.string(),
    subTag: z.string().optional().nullable(),
});

export async function GET() {
    try {
        const snapshot = await db.collection("classification_rules").orderBy("lastUsed", "desc").get();
        const rules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(rules);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const validated = RuleSchema.parse(body);

        const docRef = await db.collection("classification_rules").add({
            ...validated,
            count: 0,
            lastUsed: new Date(),
            createdAt: new Date()
        });

        return NextResponse.json({ id: docRef.id, ...validated });
    } catch (error) {
        return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
}
