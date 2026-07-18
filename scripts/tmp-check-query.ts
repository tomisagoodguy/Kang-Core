/** 重現 /api/accounting 的查詢，檢查複合索引是否存在 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
    const { db } = await import("../src/lib/firebase/admin");
    const userId = "U25b28d3aa349e5656e48465da431fab6";
    try {
        const snap = await db
            .collection("accounting")
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .limit(5)
            .get();
        console.log(`OK，取得 ${snap.size} 筆：`);
        snap.docs.forEach((d) => console.log(d.data().date, d.data().description));
    } catch (e) {
        console.error("查詢失敗：", (e as Error).message);
    }
}

main().then(() => process.exit(0));
