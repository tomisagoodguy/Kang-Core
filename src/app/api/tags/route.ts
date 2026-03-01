import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { CustomTagSchema } from "@/models/schema";

export async function GET() {
    try {
        const snapshot = await db.collection("custom_tags").orderBy("createdAt", "asc").get();
        const tags = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));
        return NextResponse.json(tags);
    } catch (error) {
        console.error("GET /api/tags error:", error);
        return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const result = CustomTagSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: "Invalid data", details: result.error.format() }, { status: 400 });
        }

        const newTag = {
            ...result.data,
            createdAt: new Date(),
        };

        const docRef = await db.collection("custom_tags").add(newTag);
        return NextResponse.json({ id: docRef.id, ...newTag }, { status: 201 });
    } catch (error) {
        console.error("POST /api/tags error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
