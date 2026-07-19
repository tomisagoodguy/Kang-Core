import { NextResponse } from "next/server";
import { syncEinvoices } from "@/services/invoiceImport.service";
import { getAuthorizedEmail } from "@/lib/gmail/client";
import { getAllLineUserIds, getLineUserIdFromEmail } from "@/lib/userRegistry";
import { lineService } from "@/services/line.service";
import { getTagEmoji } from "@/utils/tagEmoji";

/**
 * 財政部電子發票 Gmail 自動記帳
 * Vercel Cron: 30 12 * * * (UTC) -> 台灣時間 20:30（趕在 21:00 每日摘要前入帳）
 *
 * Gmail 帳號 = GOOGLE_OAUTH_REFRESH_TOKEN 的授權帳號（單一信箱），
 * 入帳的 userId 以該信箱透過 EMAIL_LINE_MAP 反查，查不到 fallback 第一位註冊用戶。
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const email = await getAuthorizedEmail();
        const userId = (email && getLineUserIdFromEmail(email)) || getAllLineUserIds()[0];
        if (!userId) {
            return NextResponse.json({ error: "無法解析 userId（EMAIL_LINE_MAP / LINE_USER_IDS 未設定）" }, { status: 500 });
        }

        const result = await syncEinvoices(userId);

        if (result.imported.length > 0) {
            const lines = result.imported.slice(0, 15).map((inv) => {
                const flag = inv.suspectedDuplicate ? " ⚠️疑似重複" : "";
                return `${getTagEmoji(inv.tag)} ${inv.date.slice(5)} ${inv.merchantName} $${inv.amount.toLocaleString("zh-TW")}${flag}`;
            });
            const total = result.imported.reduce((sum, inv) => sum + inv.amount, 0);
            const overflow = result.imported.length > 15 ? [`…及其他 ${result.imported.length - 15} 筆`] : [];
            const suspects = result.imported.filter((inv) => inv.suspectedDuplicate).length;
            await lineService.pushText(userId, [
                `🧾 電子發票自動入帳 ${result.imported.length} 筆`,
                "━━━━━━━━━━━━",
                ...lines,
                ...overflow,
                `合計 $${total.toLocaleString("zh-TW")}`,
                ...(suspects > 0 ? [`⚠️ ${suspects} 筆與手動記帳同日同額，請到 Dashboard 確認是否重複`] : []),
            ].join("\n"));
        }

        if (result.errors.length > 0) {
            console.error("[cron-invoice-sync] Errors:", result.errors);
        }

        return NextResponse.json({
            status: "ok",
            userId,
            messages: result.messages,
            attachments: result.attachments,
            imported: result.imported.length,
            duplicates: result.duplicates,
            errors: result.errors,
        });
    } catch (error) {
        console.error("[cron-invoice-sync] Error:", error);
        const message = error instanceof Error ? error.message : "Failed";
        // gmail.readonly scope 未授權時給明確指引，避免靜默失敗
        const hint = message.includes("insufficient") || message.includes("403")
            ? "（可能缺 gmail.readonly scope，請重跑 npx tsx scripts/refresh-google-token.ts）"
            : "";
        return NextResponse.json({ error: `${message}${hint}` }, { status: 500 });
    }
}
