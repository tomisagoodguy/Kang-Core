import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const [usersSnapshot, topicsSnapshot] = await Promise.all([
            db.collection("threads_users").orderBy("addedAt", "asc").get(),
            db.collection("threads_topics").orderBy("addedAt", "asc").get(),
        ]);

        const users = usersSnapshot.docs.map((doc) => ({
            username: doc.data().username as string,
        }));
        const topics = topicsSnapshot.docs.map((doc) => ({
            keyword: doc.data().keyword as string,
        }));

        return NextResponse.json({ users, topics });
    } catch (e) {
        console.error("[GET /api/threads/tracking] Error:", e);
        return NextResponse.json({ error: "Failed to fetch tracking lists" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const type = body.type as string;
        const rawValue = (body.value as string || "").trim();
        if (!rawValue) {
            return NextResponse.json({ error: "value is required" }, { status: 400 });
        }

        if (type === "author") {
            const username = rawValue.replace(/^@/, "").toLowerCase();
            await db.collection("threads_users").doc(username).set({
                username,
                maxPosts: 10,
                addedAt: new Date(),
                source: "dashboard",
            }, { merge: true });
            return NextResponse.json({ success: true, username });
        }

        if (type === "topic") {
            await db.collection("threads_topics").doc(rawValue).set({
                keyword: rawValue,
                addedAt: new Date(),
                source: "dashboard",
            }, { merge: true });
            return NextResponse.json({ success: true, keyword: rawValue });
        }

        return NextResponse.json({ error: "type must be 'author' or 'topic'" }, { status: 400 });
    } catch (e) {
        console.error("[POST /api/threads/tracking] Error:", e);
        return NextResponse.json({ error: "Failed to add tracking target" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type");
        const value = searchParams.get("value");
        if (!value) {
            return NextResponse.json({ error: "value is required" }, { status: 400 });
        }

        if (type === "author") {
            await db.collection("threads_users").doc(value.toLowerCase()).delete();
            return NextResponse.json({ success: true });
        }

        if (type === "topic") {
            await db.collection("threads_topics").doc(value).delete();
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "type must be 'author' or 'topic'" }, { status: 400 });
    } catch (e) {
        console.error("[DELETE /api/threads/tracking] Error:", e);
        return NextResponse.json({ error: "Failed to remove tracking target" }, { status: 500 });
    }
}
