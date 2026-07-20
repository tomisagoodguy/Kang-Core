'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { signOut } from "@/lib/firebase/auth";
import { ThemeToggle } from "./ThemeToggle";
import { Brain, Receipt, ReceiptText, Library, CalendarDays, MessageCircle, Settings, Repeat, Tags, ListTree, LogOut, Wallet, Landmark } from "lucide-react";

const navLinks = [
    { href: "/", label: "首頁" },
    { href: "/accounting", label: "記帳", icon: <Receipt size={16} /> },
    { href: "/einvoice", label: "發票", icon: <ReceiptText size={16} /> },
    { href: "/assets", label: "資產", icon: <Wallet size={16} /> },
    { href: "/archive", label: "存檔", icon: <Library size={16} /> },
    { href: "/calendar", label: "日曆", icon: <CalendarDays size={16} /> },
    { href: "/threads", label: "洞察", icon: <MessageCircle size={16} /> },
];

const settingsLinks = [
    { href: "/recurring", label: "定期", icon: <Repeat size={14} /> },
    { href: "/loans", label: "貸款", icon: <Landmark size={14} /> },
    { href: "/settings/tags", label: "標籤", icon: <Tags size={14} /> },
    { href: "/settings/rules", label: "規則", icon: <ListTree size={14} /> },
];

export function Navbar() {
    const pathname = usePathname();
    const { user } = useAuth();

    // 登入頁不顯示 Navbar
    if (pathname === "/login") return null;

    return (
        <nav className="navbar" style={{ padding: "0 24px", display: "flex", gap: "24px" }}>
            <Link href="/" className="navbar-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: "linear-gradient(135deg, var(--accent-light) 0%, var(--accent) 100%)", borderRadius: "8px", padding: "4px", color: "white" }}>
                    <Brain size={20} />
                </div>
                Kang Core
            </Link>

            <div className="navbar-links" style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
                {navLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`navbar-link ${pathname === link.href ? "active" : ""}`}
                        style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                        {link.icon}
                        <span>{link.label}</span>
                    </Link>
                ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {/* 設定下拉選單 */}
                <div className="navbar-dropdown">
                    <div className={`navbar-link ${settingsLinks.some(link => pathname === link.href) ? "active" : ""}`} style={{ cursor: "default", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Settings size={16} /> 設定
                    </div>
                    <div className="navbar-dropdown-content">
                        <div className="navbar-dropdown-inner">
                            {settingsLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`navbar-link ${pathname === link.href ? "active" : ""}`}
                                    style={{ margin: "2px", width: "auto", display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-start", padding: "8px 16px" }}
                                >
                                    {link.icon}
                                    <span>{link.label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ width: "1px", height: "24px", background: "var(--border-glass)", margin: "0 4px" }} />

                <ThemeToggle />

                {user && (
                    <button
                        className="navbar-logout"
                        style={{ display: "flex", alignItems: "center", gap: "6px", border: "none", background: "var(--bg-glass)", padding: "8px 12px", borderRadius: "8px" }}
                        onClick={async () => {
                            await signOut();
                            window.location.href = "/login";
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"; e.currentTarget.style.color = "var(--danger)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-glass)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                    >
                        <LogOut size={14} /> 登出
                    </button>
                )}
            </div>
        </nav>
    );
}

