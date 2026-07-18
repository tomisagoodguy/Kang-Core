import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { CustomTagSchema } from "@/models/schema";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

export async function GET() {
    try {
        const userId = await getSessionUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 排序在 JS 端做：where + orderBy 需要複合索引，此集合每用戶僅少量文件
        const snapshot = await db
            .collection("custom_tags")
            .where("userId", "==", userId)
            .get();
        const ts = (v: unknown) => (v as { toMillis?: () => number })?.toMillis?.() ?? (v ? new Date(v as string).getTime() : 0);
        const tags = snapshot.docs
            .sort((a, b) => ts(a.data().createdAt) - ts(b.data().createdAt))
            .map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(tags);
    } catch (error) {
        console.error("GET /api/tags error:", error);
        return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getSessionUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const result = CustomTagSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: "Invalid data", details: result.error.format() }, { status: 400 });
        }

        const newTag = {
            ...result.data,
            userId,
            createdAt: new Date(),
        };

        const docRef = await db.collection("custom_tags").add(newTag);
        return NextResponse.json({ id: docRef.id, ...newTag }, { status: 201 });
    } catch (error) {
        console.error("POST /api/tags error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
