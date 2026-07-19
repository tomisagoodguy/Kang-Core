import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

/**
 * 月底結餘預測校準係數
 * GET /api/forecast-calibration — 回傳目前用戶的校準係數（由 monthly-report cron 依歷史誤差滾動更新）
 */
export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const doc = await db.collection("forecast_calibration").doc(userId).get();
        const data = doc.data();
        return NextResponse.json({
            biasMultiplier: (data?.biasMultiplier as number | undefined) ?? 1,
            sampleCount: (data?.sampleCount as number | undefined) ?? 0,
        });
    } catch (err) {
        console.error("[forecast-calibration] GET error:", err);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
