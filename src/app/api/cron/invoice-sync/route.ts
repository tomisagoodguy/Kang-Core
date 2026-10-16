import { NextResponse } from "next/server";
import { syncEinvoices } from "@/services/invoiceImport.service";
import { getAuthorizedEmail } from "@/lib/gmail/client";
import { getAllLineUserIds, getLineUserIdFromEmail } from "@/lib/userRegistry";
import { lineService } from "@/services/line.service";
import { getTagEmoji } from "@/utils/tagEmoji";
import { describeGoogleError } from "@/utils/googleError";

const MEMBER_LABEL: Record<string, string> = { me: "我", dad: "爸", mom: "媽" };

/**
 * 財政部電子發票 Gmail 自動匯入（家庭帳 einvoice_records，不進個人 accounting）
 * Vercel Cron: 30 12 * * * (UTC) -> 台灣時間 20:30
 *
 * Gmail 帳號 = GOOGLE_OAUTH_REFRESH_TOKEN 的授權帳號（單一信箱），
 * 帳本 userId 以該信箱透過 EMAIL_LINE_MAP 反查，查不到 fallback 第一位註冊用戶。
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
                const who = inv.member ? `[${MEMBER_LABEL[inv.member] ?? inv.member}] ` : "";
                return `${getTagEmoji(inv.tag)} ${inv.date.slice(5)} ${who}${inv.merchantName} $${inv.amount.toLocaleString("zh-TW")}`;
            });
            const total = result.imported.reduce((sum, inv) => sum + inv.amount, 0);
            const overflow = result.imported.length > 15 ? [`…及其他 ${result.imported.length - 15} 筆`] : [];
            const unassigned = result.imported.filter((inv) => !inv.member).length;
            await lineService.pushText(userId, [
                `🧾 家庭發票新入帳 ${result.imported.length} 筆`,
                "━━━━━━━━━━━━",
                ...lines,
                ...overflow,
                `合計 $${total.toLocaleString("zh-TW")}`,
                ...(unassigned > 0 ? [`👥 ${unassigned} 筆未歸屬成員，可到 Dashboard「發票」頁指定（指定過的商家之後會自動歸屬）`] : []),
            ].join("\n"));
        }

        if (result.errors.length > 0) {
            console.error("[cron-invoice-sync] Errors:", result.errors);
            await lineService.pushText(userId, [
                `⚠️ 發票同步部分失敗（${result.errors.length} 項）`,
                ...result.errors.slice(0, 5).map((e) => `・${String(e).slice(0, 120)}`),
                ...(result.imported.length > 0 ? [`其餘 ${result.imported.length} 筆已正常入帳`] : []),
            ].join("\n")).catch((pushErr) => console.error("[cron-invoice-sync] 推播部分失敗通知失敗:", pushErr));
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
        const { message, hint } = describeGoogleError(error);
        // 失敗主動推播，避免 cron 只回 500 而長期無人察覺（授權失效時還拿不到信箱，推給主要用戶）
        const notifyUserId = getAllLineUserIds()[0];
        if (notifyUserId) {
            await lineService.pushText(notifyUserId, [
                "❌ 電子發票同步失敗",
                "━━━━━━━━━━━━",
                `原因：${message.slice(0, 200)}`,
                ...(hint ? ["", `🔧 ${hint}`] : []),
            ].join("\n")).catch((pushErr) => console.error("[cron-invoice-sync] 推播失敗通知失敗:", pushErr));
        }
        return NextResponse.json({ error: hint ? `${message}（${hint}）` : message }, { status: 500 });
    }
}
