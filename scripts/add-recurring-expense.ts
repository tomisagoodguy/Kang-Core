/**
 * 新增一筆每月定期支出（與 POST /api/recurring 相同的 Zod 驗證與寫入欄位）
 * 用法：npx tsx scripts/add-recurring-expense.ts <email> <dayOfMonth> <amount> <tag> <description> [--apply]
 * 例：  npx tsx scripts/add-recurring-expense.ts me@gmail.com 10 1188 Health 健身房月費 --apply
 * 不加 --apply 為 dry-run，只印出將寫入的資料。同用戶已有同描述的規則時拒絕寫入。
 */
import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import * as path from "path";
import { RecurringExpenseSchema } from "../src/models/schema";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const [email, dayArg, amountArg, tag, description] = process.argv.slice(2);
const apply = process.argv.includes("--apply");

if (!email || !dayArg || !amountArg || !tag || !description) {
    console.error("用法：npx tsx scripts/add-recurring-expense.ts <email> <dayOfMonth> <amount> <tag> <description> [--apply]");
    process.exit(1);
}

/** 由 EMAIL_LINE_MAP 反查 LINE userId（與 Dashboard 登入映射一致） */
function resolveUserId(target: string): string | undefined {
    const pairs = (process.env.EMAIL_LINE_MAP || "").split(",").map((s) => s.trim()).filter(Boolean);
    for (const pair of pairs) {
        const idx = pair.lastIndexOf(":");
        if (pair.slice(0, idx).trim().toLowerCase() === target.toLowerCase()) return pair.slice(idx + 1).trim();
    }
    return undefined;
}

async function main() {
    const userId = resolveUserId(email);
    if (!userId) {
        console.error(`❌ EMAIL_LINE_MAP 找不到 ${email} 對應的 LINE userId`);
        process.exit(1);
    }

    const parsed = RecurringExpenseSchema.safeParse({
        amount: Number(amountArg),
        tag,
        description,
        frequency: "monthly",
        dayOfMonth: Number(dayArg),
        isActive: true,
        source: "manual",
        originalText: `Script: add-recurring-expense ${description}`,
    });
    if (!parsed.success) {
        console.error("❌ 驗證失敗：", JSON.stringify(parsed.error.format(), null, 2));
        process.exit(1);
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID!,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
                privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
            }),
        });
    }
    const db = admin.firestore();

    const dup = await db.collection("recurring_expenses")
        .where("userId", "==", userId)
        .where("description", "==", description)
        .get();
    if (!dup.empty) {
        console.error(`❌ 已存在同描述的定期支出（${dup.docs.map((d) => d.id).join(", ")}），未寫入`);
        process.exit(1);
    }

    const insertData = { ...parsed.data, userId, createdAt: new Date() };
    console.log(`userId: ${userId.slice(0, 6)}…`);
    console.log("將寫入：", { ...insertData, userId: undefined });

    if (!apply) {
        console.log("🔍 dry-run，未寫入。確認無誤請加 --apply");
        return;
    }
    const ref = await db.collection("recurring_expenses").add(insertData);
    console.log(`✅ 已新增 recurring_expenses/${ref.id}`);
}

main().catch((err) => {
    console.error("❌ 執行失敗：", err);
    process.exit(1);
});
