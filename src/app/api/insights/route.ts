import { NextRequest, NextResponse } from "next/server";
import { generateFinancialInsights } from "@/services/insights";

// Cache to prevent multiple Gemini calls in a single session
let lastInsight: string | null = null;
let lastUpdate: number = 0;

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const force = url.searchParams.get("force") === "true";
        const now = Date.now();

        // Cache for 1 hour to stay within free limits and reduce cost/latency
        if (!force && lastInsight && now - lastUpdate < 3600000) {
            return NextResponse.json({ insight: lastInsight, cached: true });
        }

        const insight = await generateFinancialInsights("default_user");
        lastInsight = insight;
        lastUpdate = now;

        return NextResponse.json({ insight, cached: false });
    } catch (error) {
        console.error("GET /api/insights error:", error);
        return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
    }
}
