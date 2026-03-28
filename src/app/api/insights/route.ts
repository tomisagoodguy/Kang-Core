import { NextRequest, NextResponse } from "next/server";
import { generateFinancialInsights } from "@/services/insights";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

// Per-user cache to prevent multiple Gemini calls
const insightCache = new Map<string, { insight: string; updatedAt: number }>();

export async function GET(req: NextRequest) {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const url = new URL(req.url);
        const force = url.searchParams.get("force") === "true";
        const now = Date.now();
        const cached = insightCache.get(userId);

        // Cache for 1 hour to stay within free limits and reduce cost/latency
        if (!force && cached && now - cached.updatedAt < 3600000) {
            return NextResponse.json({ insight: cached.insight, cached: true });
        }

        const insight = await generateFinancialInsights(userId);
        insightCache.set(userId, { insight, updatedAt: now });

        return NextResponse.json({ insight, cached: false });
    } catch (error) {
        console.error("GET /api/insights error:", error);
        return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
    }
}
