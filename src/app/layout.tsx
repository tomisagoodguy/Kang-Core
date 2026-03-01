import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
    title: "康 Core — AI 個人助理儀表板",
    description: "透過 LINE Bot 記帳與知識存檔，AI 自動分類與整理你的生活資料。",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "康 Core",
    },
};

export const viewport = {
    themeColor: "#6366f1",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-Hant">
            <body>
                <AuthProvider>
                    <ThemeProvider>
                        <Navbar />
                        <main>{children}</main>
                    </ThemeProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
