import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { sendHtmlEmail } from "@/lib/gmail/client";
import { getAllLineUserIds, getEmailFromLineUserId } from "@/lib/userRegistry";
import { getTagEmoji } from "@/utils/tagEmoji";
import { myExpenseTWD, formatMoney, PAYMENT_LABELS } from "@/utils/currency";

/**
 * 每週消費/收入報表 Email
 * Vercel Cron: 0 0 * * 1 (UTC) → 每週一 08:00 UTC+8，寄「上週一～上週日」報表
 * 收件者由 EMAIL_LINE_MAP 反查（無對應 email 的用戶跳過）
 */

interface EntryData {
    date?: string;
    amount?: number;
    amountTWD?: number;
    exchangeRate?: number;
    currency?: string;
    tag?: string;
    subTag?: string;
    description?: string;
    originalText?: string;
    paymentMethod?: string;
    settlement?: { paidBy: "me" | "other"; counterparty: string; myShare: number; settled?: boolean } | null;
}

const nt = (n: number) => `NT$${Math.round(n).toLocaleString("en-US")}`;

/** 一筆明細的金額顯示：原幣為主，外幣附台幣換算 */
function amountCell(e: EntryData): string {
    const currency = e.currency || "TWD";
    const original = formatMoney(e.amount ?? 0, currency);
    if (currency === "TWD") return original;
    return `${original}<br><span style="color:#9ca3af;font-size:11px;">≈ ${nt(e.amountTWD ?? 0)}</span>`;
}

function buildEmailHtml(params: {
    fromLabel: string;
    toLabel: string;
    entries: EntryData[];
    prevExpense: number;
}): string {
    const { fromLabel, toLabel, entries, prevExpense } = params;

    const expenses = entries.filter((e) => e.tag !== "Income");
    const incomes = entries.filter((e) => e.tag === "Income");
    const totalExpense = expenses.reduce((s, e) => s + myExpenseTWD(e), 0);
    const totalIncome = incomes.reduce((s, e) => s + myExpenseTWD(e), 0);
    const net = totalIncome - totalExpense;

    // 週增減
    let comparisonHtml = "";
    if (prevExpense > 0) {
        const diffPct = ((totalExpense - prevExpense) / prevExpense) * 100;
        const up = totalExpense > prevExpense;
        comparisonHtml = `<p style="margin:12px 0 0;font-size:13px;color:${up ? "#dc2626" : "#16a34a"};">
            ${up ? "📈" : "📉"} 支出較前一週${up ? "增加" : "減少"} ${Math.abs(diffPct).toFixed(1)}%（前週 ${nt(prevExpense)}）
        </p>`;
    }

    // 分類佔比（支出）
    const tagMap = new Map<string, number>();
    expenses.forEach((e) => {
        const tag = e.tag || "Other";
        tagMap.set(tag, (tagMap.get(tag) || 0) + myExpenseTWD(e));
    });
    const tagRows = Array.from(tagMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([tag, amt]) => {
            const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
            return `<tr>
                <td style="padding:6px 0;font-size:13px;color:#374151;white-space:nowrap;">${getTagEmoji(tag)} ${tag}</td>
                <td style="padding:6px 12px;width:100%;">
                    <div style="background:#f3f4f6;border-radius:4px;height:8px;">
                        <div style="background:#6366f1;border-radius:4px;height:8px;width:${Math.max(pct, 2)}%;"></div>
                    </div>
                </td>
                <td style="padding:6px 0;font-size:13px;color:#111827;text-align:right;white-space:nowrap;">${nt(amt)}<span style="color:#9ca3af;"> (${pct}%)</span></td>
            </tr>`;
        })
        .join("");

    // Top 5 單筆支出
    const top5Rows = [...expenses]
        .sort((a, b) => myExpenseTWD(b) - myExpenseTWD(a))
        .slice(0, 5)
        .map((e, i) => `<tr>
            <td style="padding:5px 8px 5px 0;font-size:13px;color:#9ca3af;">${i + 1}</td>
            <td style="padding:5px 8px 5px 0;font-size:13px;color:#374151;">${e.date?.slice(5).replace("-", "/") ?? ""}　${e.description || e.originalText || "—"}</td>
            <td style="padding:5px 0;font-size:13px;font-weight:600;color:#dc2626;text-align:right;white-space:nowrap;">${nt(myExpenseTWD(e))}</td>
        </tr>`)
        .join("");

    // 明細表：按日期分組（由舊到新）
    const byDate = new Map<string, EntryData[]>();
    [...entries]
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
        .forEach((e) => {
            const d = e.date ?? "未知日期";
            if (!byDate.has(d)) byDate.set(d, []);
            byDate.get(d)!.push(e);
        });

    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const detailRows = Array.from(byDate.entries())
        .map(([date, dayEntries]) => {
            const dateObj = new Date(`${date}T00:00:00`);
            const wd = Number.isNaN(dateObj.getTime()) ? "" : `（週${weekdays[dateObj.getDay()]}）`;
            const header = `<tr>
                <td colspan="4" style="padding:10px 8px 6px;background:#f9fafb;font-size:12px;font-weight:700;color:#6b7280;border-top:1px solid #e5e7eb;">
                    ${date.slice(5).replace("-", "/")}${wd}
                </td>
            </tr>`;
            const rows = dayEntries.map((e) => {
                const isIncome = e.tag === "Income";
                const payment = e.paymentMethod ? PAYMENT_LABELS[e.paymentMethod] : null;
                const settle = e.settlement
                    ? `<br><span style="color:#f59e0b;font-size:11px;">🤝 ${e.settlement.paidBy === "me" ? `我先付，${e.settlement.counterparty} 欠我` : `${e.settlement.counterparty} 先付，我欠`}${e.settlement.settled ? "（已結清）" : ""}</span>`
                    : "";
                return `<tr>
                    <td style="padding:6px 8px;font-size:13px;color:#111827;border-top:1px solid #f3f4f6;">
                        ${e.description || e.originalText || "—"}${settle}
                    </td>
                    <td style="padding:6px 8px;font-size:12px;color:#6b7280;border-top:1px solid #f3f4f6;white-space:nowrap;">
                        ${getTagEmoji(e.tag || "Other")} ${e.tag || "Other"}${e.subTag ? ` / ${e.subTag}` : ""}
                    </td>
                    <td style="padding:6px 8px;font-size:12px;color:#6b7280;border-top:1px solid #f3f4f6;white-space:nowrap;">
                        ${payment ? `${payment.emoji} ${payment.label}` : "—"}
                    </td>
                    <td style="padding:6px 8px;font-size:13px;font-weight:600;text-align:right;border-top:1px solid #f3f4f6;white-space:nowrap;color:${isIncome ? "#16a34a" : "#111827"};">
                        ${isIncome ? "+" : "-"}${amountCell(e)}
                    </td>
                </tr>`;
            }).join("");
            return header + rows;
        })
        .join("");

    return `
<div style="font-family:-apple-system,'Segoe UI','Noto Sans TC','Microsoft JhengHei',sans-serif;background:#f5f6f8;padding:24px 12px;">
  <div style="max-width:640px;margin:0 auto;">
    <div style="background:#1f2937;border-radius:12px 12px 0 0;padding:20px 24px;">
      <h1 style="margin:0;font-size:18px;color:#ffffff;">📊 每週收支報表</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#9ca3af;">${fromLabel} ～ ${toLabel}・共 ${entries.length} 筆</p>
    </div>
    <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;">

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;text-align:center;">
        <tr>
          <td style="padding:12px;background:#fef2f2;border-radius:8px;">
            <p style="margin:0;font-size:12px;color:#6b7280;">支出</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#dc2626;">${nt(totalExpense)}</p>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:12px;background:#f0fdf4;border-radius:8px;">
            <p style="margin:0;font-size:12px;color:#6b7280;">收入</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#16a34a;">${nt(totalIncome)}</p>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:12px;background:#f9fafb;border-radius:8px;">
            <p style="margin:0;font-size:12px;color:#6b7280;">結餘</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${net >= 0 ? "#16a34a" : "#dc2626"};">${net < 0 ? "-" : ""}${nt(Math.abs(net))}</p>
          </td>
        </tr>
      </table>
      ${comparisonHtml}

      ${tagRows ? `
      <h2 style="margin:24px 0 8px;font-size:14px;color:#111827;">🏷 分類佔比</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${tagRows}</table>` : ""}

      ${top5Rows ? `
      <h2 style="margin:24px 0 8px;font-size:14px;color:#111827;">🏆 本週消費 Top 5</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${top5Rows}</table>` : ""}

      <h2 style="margin:24px 0 8px;font-size:14px;color:#111827;">📋 完整明細</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <th style="padding:6px 8px;font-size:12px;color:#9ca3af;text-align:left;font-weight:600;">項目</th>
          <th style="padding:6px 8px;font-size:12px;color:#9ca3af;text-align:left;font-weight:600;">分類</th>
          <th style="padding:6px 8px;font-size:12px;color:#9ca3af;text-align:left;font-weight:600;">付款</th>
          <th style="padding:6px 8px;font-size:12px;color:#9ca3af;text-align:right;font-weight:600;">金額</th>
        </tr>
        ${detailRows}
      </table>

      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
        由 Kang-Core 自動寄送・<a href="https://kang-core.vercel.app/accounting" style="color:#6366f1;">開啟 Dashboard</a>
      </p>
    </div>
  </div>
</div>`;
}

export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIds = getAllLineUserIds();
    if (userIds.length === 0) {
        return NextResponse.json({ error: "LINE_USER_IDS not set" }, { status: 500 });
    }

    // 以台灣時間（UTC+8）為基準，計算「上週一～上週日」
    const nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const daysSinceMonday = (nowTW.getUTCDay() + 6) % 7;
    const thisMonday = new Date(nowTW);
    thisMonday.setUTCDate(nowTW.getUTCDate() - daysSinceMonday);

    const shiftDays = (base: Date, days: number) => {
        const d = new Date(base);
        d.setUTCDate(base.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
    };

    const from = shiftDays(thisMonday, -7);   // 上週一
    const to = shiftDays(thisMonday, -1);     // 上週日
    const prevFrom = shiftDays(thisMonday, -14); // 前週一（對比用）
    const prevTo = shiftDays(thisMonday, -8);    // 前週日

    const results: Array<{ userId: string; email: string | null; sent: boolean; count?: number }> = [];

    for (const userId of userIds) {
        const email = getEmailFromLineUserId(userId);
        if (!email) {
            results.push({ userId, email: null, sent: false });
            continue;
        }

        try {
            const snap = await db
                .collection("accounting")
                .where("userId", "==", userId)
                .where("date", ">=", from)
                .where("date", "<=", to)
                .get();
            const entries = snap.docs.map((d) => d.data() as EntryData);

            if (entries.length === 0) {
                results.push({ userId, email, sent: false, count: 0 });
                continue;
            }

            const prevSnap = await db
                .collection("accounting")
                .where("userId", "==", userId)
                .where("date", ">=", prevFrom)
                .where("date", "<=", prevTo)
                .get();
            const prevExpense = prevSnap.docs
                .map((d) => d.data() as EntryData)
                .filter((e) => e.tag !== "Income")
                .reduce((s, e) => s + myExpenseTWD(e), 0);

            const fromLabel = from.replace(/-/g, "/");
            const toLabel = to.replace(/-/g, "/");
            const html = buildEmailHtml({ fromLabel, toLabel, entries, prevExpense });

            await sendHtmlEmail(email, `📊 Kang-Core 週報 ${fromLabel}～${toLabel}`, html);
            results.push({ userId, email, sent: true, count: entries.length });
        } catch (err) {
            console.error(`[weekly-email-report] Error for user ${userId}:`, err);
            results.push({ userId, email, sent: false });
        }
    }

    return NextResponse.json({ status: "ok", from, to, results });
}
