'use client';

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="navbar-logout" // Reuse standard button style
            style={{
                fontSize: "1.1rem",
                padding: "6px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: "8px"
            }}
            title={theme === "dark" ? "切換至淺色模式" : "切換至深色模式"}
        >
            {theme === "dark" ? "🌙" : "☀️"}
        </button>
    );
}
