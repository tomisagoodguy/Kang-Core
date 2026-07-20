import type { CalendarEntryView } from "@/models/schema";

export type CalendarSourceKind = "todo" | "gcal-primary" | "gcal-secondary" | "task";

export interface CalendarSourceMeta {
    kind: CalendarSourceKind;
    label: string;
    color: string;
    readOnly: boolean;
}

/** 判斷一筆行事曆項目的資料來源（待辦 / Google 主日曆 / Google 次要日曆 / Google Tasks），供顏色與圖示共用。 */
export function getCalendarSourceMeta(entry: Pick<CalendarEntryView, "id" | "calendarSummary">): CalendarSourceMeta {
    if (entry.id.startsWith("task-")) {
        return { kind: "task", label: "Google Tasks", color: "var(--brand-google-yellow)", readOnly: true };
    }
    if (entry.id.startsWith("gcal-")) {
        if (entry.calendarSummary) {
            return { kind: "gcal-secondary", label: entry.calendarSummary, color: "var(--brand-google-red)", readOnly: true };
        }
        return { kind: "gcal-primary", label: "Google 日曆", color: "var(--brand-google-blue)", readOnly: true };
    }
    return { kind: "todo", label: "待辦事項", color: "var(--success)", readOnly: false };
}
