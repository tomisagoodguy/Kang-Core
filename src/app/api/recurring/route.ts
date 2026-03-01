import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { RecurringExpenseSchema } from "@/models/schema";

export async function GET() {
    try {
        const snapshot = await db.collection("recurring_expenses").orderBy("createdAt", "desc").get();
        const docs = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            };
        });
        return NextResponse.json(docs);
    } catch (error) {
        console.error("GET /api/recurring error:", error);
        return NextResponse.json({ error: "Failed to fetch recurring expenses" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 解析並驗證輸入
        const result = RecurringExpenseSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid input", details: result.error.format() },
                { status: 400 }
            );
        }

        const data = result.data;
        const insertData = {
            ...data,
            createdAt: new Date(),
        };

        const docRef = await db.collection("recurring_expenses").add(insertData);

        return NextResponse.json(
            { id: docRef.id, ...insertData },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/recurring error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
