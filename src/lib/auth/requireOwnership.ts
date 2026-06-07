import { db } from "@/lib/firebase/admin";
import type { DocumentSnapshot } from "firebase-admin/firestore";

/**
 * 驗證 Firestore 文件存在且屬於指定用戶。
 * 統一回傳 null（不存在或非本人），避免透過 HTTP status 差異洩漏文件存在性。
 */
export async function requireOwnership(
    collection: string,
    id: string,
    userId: string
): Promise<DocumentSnapshot | null> {
    const snap = await db.collection(collection).doc(id).get();
    if (!snap.exists || snap.data()?.userId !== userId) {
        return null;
    }
    return snap;
}
