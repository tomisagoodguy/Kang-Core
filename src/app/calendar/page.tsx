import { CalendarMonthView } from "@/components/CalendarMonthView";
import { CalendarDays } from "lucide-react";

export default function CalendarPage() {
    return (
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <CalendarDays className="text-accent" size={28} />
                行事曆總覽
            </h1>
            <p className="page-subtitle">整合 Google 日曆（含次要日曆）、Google Tasks 與系統待辦事項</p>

            <CalendarMonthView />
        </div>
    );
}
