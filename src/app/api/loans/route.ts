import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { LoanSchema } from "@/models/schema";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";
import { computeMonthlyPayment } from "@/utils/loan";

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        // 排序在 JS 端做：where + orderBy 需要複合索引，此集合每用戶僅少量文件
        const snapshot = await db.collection("loans")
            .where("userId", "==", userId)
            .get();
        const ts = (v: unknown) => (v as { toMillis?: () => number })?.toMillis?.() ?? (v ? new Date(v as string).getTime() : 0);
        const docs = snapshot.docs
            .sort((a, b) => ts(b.data().createdAt) - ts(a.data().createdAt))
            .map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                };
            });
        return NextResponse.json(docs);
    } catch (error) {
        console.error("GET /api/loans error:", error);
        return NextResponse.json({ error: "Failed to fetch loans" }, { status: 500 });
    }
}

const CreateLoanSchema = LoanSchema.omit({
    id: true,
    createdAt: true,
    source: true,
    originalText: true,
    monthlyPayment: true,
    remainingPrincipal: true,
    paidInstallments: true,
    status: true,
    lastTriggeredAt: true,
    userId: true,
});

export async function POST(request: Request) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const body = await request.json();

        const result = CreateLoanSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid input", details: result.error.format() },
                { status: 400 }
            );
        }

        const { name, principal, annualRate, termMonths, startDate, dayOfMonth } = result.data;
        const monthlyPayment = computeMonthlyPayment(principal, annualRate, termMonths);

        const insertData = {
            userId,
            source: "manual" as const,
            originalText: `Dashboard: ${name}`,
            name,
            principal,
            annualRate,
            termMonths,
            startDate,
            dayOfMonth,
            monthlyPayment,
            remainingPrincipal: principal,
            paidInstallments: 0,
            status: "active" as const,
            createdAt: new Date(),
        };

        const docRef = await db.collection("loans").add(insertData);

        return NextResponse.json(
            { id: docRef.id, ...insertData },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/loans error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
