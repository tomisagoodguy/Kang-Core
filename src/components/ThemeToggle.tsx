'use client';

import { useTheme } from "./ThemeProvider";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="navbar-logout" // Reuse standard button style
            style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: "8px",
                borderRadius: "8px",
                border: "none",
                background: "var(--bg-glass)",
                color: "var(--text-secondary)",
                transition: "all 0.2s"
            }}
            title={theme === "dark" ? "切換至淺色模式" : "切換至深色模式"}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--hover-bg)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "var(--bg-glass)"; }}
        >
            {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
    );
}
