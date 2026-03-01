import { NextResponse } from "next/server";
import { admin } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

const COOKIE_NAME = "firebase-session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 5; // 5 天

function getAuthorizedEmails(): string[] {
    const raw = process.env.AUTHORIZED_EMAILS || "";
    return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export async function POST(req: Request) {
    try {
        const { idToken } = await req.json();

        if (!idToken) {
            return NextResponse.json({ error: "缺少 idToken" }, { status: 400 });
        }

        // 驗證 idToken
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const email = decodedToken.email?.toLowerCase();

        // 白名單檢查
        const authorized = getAuthorizedEmails();
        if (authorized.length > 0 && (!email || !authorized.includes(email))) {
            return NextResponse.json({ error: "未授權的帳號" }, { status: 403 });
        }

        // 建立 Session Cookie
        const sessionCookie = await admin.auth().createSessionCookie(idToken, {
            expiresIn: COOKIE_MAX_AGE * 1000, // 毫秒
        });

        const cookieStore = await cookies();
        cookieStore.set(COOKIE_NAME, sessionCookie, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: COOKIE_MAX_AGE,
            path: "/",
        });

        return NextResponse.json({ status: "ok" });
    } catch (error: unknown) {
        const err = error as Error;
        console.error("Session creation failed:", err.message);
        return NextResponse.json({ error: "認證失敗" }, { status: 401 });
    }
}

export async function DELETE() {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
    return NextResponse.json({ status: "ok" });
}
