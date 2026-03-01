import { NextResponse } from "next/server";
import { setupRichMenu } from "@/services/richMenu.service";

/**
 * 手動觸發建立 LINE Rich Menu（一次性操作）
 * POST /api/admin/setup-richmenu
 * 需要 CRON_SECRET 驗證
 */
export async function POST(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await setupRichMenu();
        return NextResponse.json({
            status: "ok",
            message: "Rich Menu 建立成功",
            richMenuId: result.richMenuId,
        });
    } catch (err: unknown) {
        const error = err as Error;
        console.error("[setup-richmenu] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
