import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { TravelModeService } from "@/services/travelMode.service";
import { z } from "zod";

/** GET /api/trips?year=2026 — 年度旅遊統計（旅程列表 + 全年支出 + 預算） */
export const GET = withAuth(async (req, userId) => {
    try {
        const yearParam = new URL(req.url).searchParams.get("year");
        const year = yearParam ? Number(yearParam) : undefined;
        const stats = await TravelModeService.getYearlyTravelStats(userId, year);
        const trips = stats.trips.map((t) => ({
            ...t,
            createdAt: (t.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString(),
        }));
        return NextResponse.json({ ...stats, trips });
    } catch (error) {
        console.error("GET /api/trips error:", error);
        return NextResponse.json({ error: "Failed to fetch travel stats" }, { status: 500 });
    }
});

const SetBudgetSchema = z.object({
    budget: z.number().positive(),
});

/** PUT /api/trips — 設定年度旅遊預算 */
export const PUT = withAuth(async (req, userId) => {
    try {
        const body = await req.json();
        const result = SetBudgetSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid input", details: result.error.format() },
                { status: 400 }
            );
        }
        await TravelModeService.setAnnualTravelBudget(userId, result.data.budget);
        return NextResponse.json({ ok: true, budget: result.data.budget });
    } catch (error) {
        console.error("PUT /api/trips error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
});
