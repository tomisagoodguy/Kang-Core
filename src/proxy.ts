import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "firebase-session";

// 需要保護的頁面路徑
const PROTECTED_PATHS = ["/", "/accounting", "/archive", "/calendar", "/recurring", "/loans", "/assets", "/threads", "/settings", "/einvoice"];

// 不需要驗證的路徑
const PUBLIC_PATHS = ["/login", "/api/webhook", "/api/auth"];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 靜態資源與公開路徑不攔截
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.includes(".") ||
        PUBLIC_PATHS.some((p) => pathname.startsWith(p))
    ) {
        return NextResponse.next();
    }

    // 檢查是否為需要保護的路徑
    const isProtected = PROTECTED_PATHS.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
    );

    if (!isProtected) {
        return NextResponse.next();
    }

    // 檢查 Session Cookie
    const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;

    if (!sessionCookie) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Cookie 存在就放行（完整驗證在 API 層做）
    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
