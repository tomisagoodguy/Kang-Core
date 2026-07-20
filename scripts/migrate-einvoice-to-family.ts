/**
 * 一次性搬移：accounting 中 source="einvoice" 的紀錄 → einvoice_records（家庭帳）。
 *
 * 背景：電子發票初版直接入個人帳，但全家共用載具，個人統計被家人消費污染。
 * 搬移時以同日同額比對剩餘手動記帳，對到的自動歸屬 member="me"。
 *
 * 執行：npx tsx scripts/migrate-einvoice-to-family.ts        # dry-run 預覽
 *       npx tsx scripts/migrate-einvoice-to-family.ts --apply # 實際搬移並刪除原紀錄
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");

async function main() {
    const { db } = await import("../src/lib/firebase/admin");

    const snap = await db.collection("accounting").where("source", "==", "einvoice").get();
    console.log(`找到 ${snap.size} 筆 source=einvoice 的個人帳紀錄${APPLY ? "，開始搬移" : "（dry-run，加 --apply 才會實際搬移）"}`);

    let moved = 0;
    let matchedMe = 0;

    for (const doc of snap.docs) {
        const data = doc.data();
        const description: string = data.description ?? "";
        // 原 description 格式：`商家（品項1、品項2）` 或純商家名
        const merchantName = description.split("（")[0] || "未識別商家";
        const itemSummary = description.includes("（")
            ? description.slice(description.indexOf("（") + 1).replace(/）$/, "")
            : undefined;

        // 同日同額比對剩餘手動記帳 → member="me"
        const daySnap = await db.collection("accounting")
            .where("userId", "==", data.userId)
            .where("date", "==", data.date)
            .get();
        let matchedId: string | null = null;
        for (const d of daySnap.docs) {
            const e = d.data();
            if (e.source === "einvoice" || e.source === "system") continue;
            const amt = typeof e.amountTWD === "number" ? e.amountTWD : e.amount;
            if (Math.round(amt) === Math.round(data.amount)) { matchedId = d.id; break; }
        }

        const recordId = `${data.userId}_${data.invoiceNumber ?? doc.id}_${data.date}`;
        const record = {
            userId: data.userId,
            invoiceNumber: data.invoiceNumber ?? "",
            date: data.date,
            merchantName,
            amount: data.amount,
            tag: data.tag,
            ...(itemSummary ? { description: itemSummary } : {}),
            member: matchedId ? "me" : null,
            ...(matchedId ? { memberSource: "auto-match", matchedAccountingEntryId: matchedId } : {}),
            createdAt: data.createdAt ?? new Date(),
        };

        if (matchedId) matchedMe += 1;

        if (APPLY) {
            await db.collection("einvoice_records").doc(recordId).set(record, { merge: true });
            await doc.ref.delete();
        }
        moved += 1;
        if (!APPLY && moved <= 5) {
            console.log(" 預覽:", JSON.stringify({ id: recordId, merchant: merchantName, amt: data.amount, date: data.date, member: record.member }));
        }
    }

    console.log(`${APPLY ? "已搬移" : "將搬移"} ${moved} 筆；其中 ${matchedMe} 筆同日同額對到手動記帳 → 自動歸屬「我」`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
