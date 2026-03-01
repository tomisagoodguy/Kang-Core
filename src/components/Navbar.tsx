'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { signOut } from "@/lib/firebase/auth";

const navLinks = [
    { href: "/", label: "首頁" },
    { href: "/accounting", label: "📊 記帳" },
    { href: "/archive", label: "📚 存檔" },
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
