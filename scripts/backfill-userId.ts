/**
 * 為舊資料補上 userId 欄位
 * 適用於 multi-user 改版前建立的記錄（accounting / archive / calendar / recurring_expenses / budgets）
 */
import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

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

// 取 LINE userId：優先 LINE_USER_IDS 的第一個，否則 LINE_USER_ID
const rawIds = (process.env.LINE_USER_IDS || process.env.LINE_USER_ID || "").split(",").map(s => s.trim()).filter(Boolean);
const TARGET_USER_ID = rawIds[0];

const COLLECTIONS = ["accounting", "archive", "calendar", "recurring_expenses", "budgets"];

async function backfillCollection(collectionName: string): Promise<void> {
    const snapshot = await db.collection(collectionName).get();
    const noUserId = snapshot.docs.filter(doc => !doc.data().userId);

    if (noUserId.length === 0) {
        console.log(`  ✓ ${collectionName}：無需補寫（共 ${snapshot.size} 筆）`);
        return;
    }

    console.log(`  補寫 ${collectionName}：${noUserId.length}/${snapshot.size} 筆缺少 userId`);

    const BATCH_SIZE = 400;
    let updated = 0;

    for (let i = 0; i < noUserId.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = noUserId.slice(i, i + BATCH_SIZE);
        for (const doc of chunk) {
            batch.update(doc.ref, { userId: TARGET_USER_ID });
        }
        await batch.commit();
        updated += chunk.length;
        console.log(`    ${updated}/${noUserId.length} 筆已更新...`);
    }

    console.log(`  ✓ ${collectionName} 完成`);
}

async function main() {
    if (!TARGET_USER_ID) {
        console.error("錯誤：找不到 LINE_USER_ID 或 LINE_USER_IDS 環境變數");
        process.exit(1);
    }

    console.log(`目標 userId：${TARGET_USER_ID}`);
    console.log(`專案：${process.env.FIREBASE_PROJECT_ID}\n`);

    for (const col of COLLECTIONS) {
        await backfillCollection(col);
    }

    console.log("\n全部完成！");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
