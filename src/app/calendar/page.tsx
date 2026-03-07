import { CalendarMonthView } from "@/components/CalendarMonthView";

export default function CalendarPage() {
    return (
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
            <div style={{ marginBottom: "24px" }}>
                <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                    🗓️ 行事曆總覽
                </h1>
                <p style={{ marginTop: "4px", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                    整合 Google Calendar 與系統待辦事項
                </p>
            </div>

            <CalendarMonthView />
        </div>
    );
}
