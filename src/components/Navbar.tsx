'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { signOut } from "@/lib/firebase/auth";
import { ThemeToggle } from "./ThemeToggle";

const navLinks = [
    { href: "/", label: "首頁" },
    { href: "/accounting", label: "📊 記帳" },
    { href: "/archive", label: "📚 存檔" },
];

const settingsLinks = [
    { href: "/recurring", label: "🔁 定期" },
    { href: "/settings/tags", label: "🏷️ 標籤" },
    { href: "/settings/rules", label: "⚙️ 規則" },
];

export function Navbar() {
    const pathname = usePathname();
    const { user } = useAuth();

    // 登入頁不顯示 Navbar
    if (pathname === "/login") return null;

    return (
        <nav className="navbar">
            <Link href="/" className="navbar-logo">
                🧠 康 Core
            </Link>
            <div className="navbar-links">
                {navLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`navbar-link ${pathname === link.href ? "active" : ""}`}
                    >
                        {link.label}
                    </Link>
                ))}

                {/* 設定下拉選單 */}
                <div className="navbar-dropdown">
                    <div className={`navbar-link ${settingsLinks.some(link => pathname === link.href) ? "active" : ""}`} style={{ cursor: "default" }}>
                        ⚙️ 設定
                    </div>
                    <div className="navbar-dropdown-content">
                        {settingsLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`navbar-link ${pathname === link.href ? "active" : ""}`}
                                style={{ margin: "2px 8px", width: "auto" }}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>

                <ThemeToggle />
                {user && (
                    <button
                        className="navbar-logout"
                        onClick={async () => {
                            await signOut();
                            window.location.href = "/login";
                        }}
                    >
                        登出
                    </button>
                )}
            </div>
        </nav>
    );
}
