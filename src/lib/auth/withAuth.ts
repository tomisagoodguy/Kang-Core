import { NextResponse } from "next/server";
import { getSessionUserId } from "./getSessionUserId";

type AuthedHandler = (req: Request, userId: string) => Promise<Response>;

/**
 * API Route wrapper：強制驗證 Session Cookie 並注入 userId。
 * 確保每個 API Route 不會因漏呼叫 getSessionUserId() 而跳過驗證。
 *
 * 用法：
 *   export const GET = withAuth(async (req, userId) => { ... });
 */
export function withAuth(handler: AuthedHandler) {
    return async (req: Request): Promise<Response> => {
        const userId = await getSessionUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return handler(req, userId);
    };
}
