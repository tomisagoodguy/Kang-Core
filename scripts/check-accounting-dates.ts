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
const userId = (process.env.LINE_USER_IDS || process.env.LINE_USER_ID || "").split(",")[0].trim();

async function main() {
    const snapshot = await db.collection("accounting").where("userId", "==", userId).get();
    const byMonth: Record<string, number> = {};

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const date: string = data.date || (data.createdAt?.toDate?.()?.toISOString?.() ?? "unknown");
        const month = date.slice(0, 7);
        byMonth[month] = (byMonth[month] || 0) + 1;
    }

    console.log(`共 ${snapshot.size} 筆，各月份分布：\n`);
    for (const [month, count] of Object.entries(byMonth).sort()) {
        console.log(`  ${month}: ${count} 筆`);
    }
}

main().catch(console.error);
