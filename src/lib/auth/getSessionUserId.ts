import { admin } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getLineUserIdFromEmail } from "@/lib/userRegistry";

const COOKIE_NAME = "firebase-session";

/**
 * 從 HTTP Request 的 Session Cookie 解析當前用戶的 LINE userId
 * 回傳 null 表示未登入或 email 未在 EMAIL_LINE_MAP 中設定
 */
export async function getSessionUserId(): Promise<string | null> {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;
        if (!sessionCookie) return null;

        const decoded = await admin.auth().verifySessionCookie(sessionCookie, true);
        const email = decoded.email?.toLowerCase();
        if (!email) return null;

        return getLineUserIdFromEmail(email);
    } catch {
        return null;
    }
}
