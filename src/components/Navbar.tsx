'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
    { href: "/", label: "首頁" },
    { href: "/accounting", label: "📊 記帳" },
    { href: "/archive", label: "📚 存檔" },
];

export function Navbar() {
    const pathname = usePathname();

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
            </div>
        </nav>
    );
}
