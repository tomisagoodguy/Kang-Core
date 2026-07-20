import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { getMonthlyEventsFromGoogleCalendar, type GCalEvent } from "@/lib/calendar/client";
import { getMonthlyGoogleTasks, type GTask } from "@/lib/tasks/client";
import type { CalendarEntryView } from "@/models/schema";
import { getSessionUserId } from "@/lib/auth/getSessionUserId";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const userId = await getSessionUserId();
        if (!userId) return NextResponse.json({ success: false, entries: [] }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

        // Format dates for Firestore query
        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
        // Last day calculation
        const lastDay = new Date(year, month, 0).getDate();
        const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        // Fetch from Firestore
        const snapshot = await db
            .collection("calendar")
            .where("userId", "==", userId)
            .where("actionDate", ">=", monthStart)
            .where("actionDate", "<=", monthEnd)
            .get();

        const firestoreEntries = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt:
                    data.createdAt instanceof Timestamp
                        ? data.createdAt.toDate().toISOString()
                        : null,
            } as CalendarEntryView;
        });

        // Fetch from Google Calendar
        let gcalEvents: GCalEvent[] = [];
        try {
            gcalEvents = await getMonthlyEventsFromGoogleCalendar(year, month);
        } catch (e) {
            const error = e as Error;
            console.error("[API/calendar/month] Failed to fetch Google Calendar:", error.message || error);
        }

        const gcalEntries: CalendarEntryView[] = gcalEvents.map((event) => {
            let actionDate = "";
            let actionTime = "";

            if (event.start?.dateTime) {
                // Set to Asia/Taipei to match app timezone
                const dt = new Date(event.start.dateTime);
                // Convert dt to string
                actionDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                actionTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            } else if (event.start?.date) {
                actionDate = event.start.date;
            }

            return {
                id: `gcal-${event.id}`,
                title: event.summary || "未命名行程",
                description: event.description,
                actionDate,
                actionTime,
                status: "pending",
                gcalEventId: event.id,
                source: "system", // Treat as system-created so we know it's external
                originalText: "Imported from Google Calendar",
            };
        });

        // Fetch from Google Tasks
        let gTasks: GTask[] = [];
        try {
            gTasks = await getMonthlyGoogleTasks(year, month);
        } catch (e) {
            const error = e as Error;
            console.error("[API/calendar/month] Failed to fetch Google Tasks:", error.message || error);
        }

        const taskEntries: CalendarEntryView[] = gTasks
            .filter((task) => task.due)
            .map((task) => ({
                id: `task-${task.id}`,
                title: task.title || "未命名工作",
                description: task.notes,
                actionDate: (task.due as string).slice(0, 10),
                actionTime: "",
                status: task.status === "completed" ? "done" : "pending",
                source: "system",
                originalText: "Imported from Google Tasks",
            }));

        // Deduplicate
        const firestoreGcalIds = new Set(firestoreEntries.map(e => e.gcalEventId).filter(Boolean));
        const filteredGcalEntries = gcalEntries.filter(e => !firestoreGcalIds.has(e.gcalEventId));

        const allEntries = [...firestoreEntries, ...filteredGcalEntries, ...taskEntries];

        // Sort by date ascending
        allEntries.sort((a, b) => {
            const timeA = new Date(`${a.actionDate || "2099-01-01"}T${a.actionTime || "00:00"}`).getTime();
            const timeB = new Date(`${b.actionDate || "2099-01-01"}T${b.actionTime || "00:00"}`).getTime();
            return timeA - timeB;
        });

        return NextResponse.json({ success: true, entries: allEntries });

    } catch (e) {
        console.error("[API/calendar/month] Error:", e);
        return NextResponse.json({ success: false, entries: [] }, { status: 500 });
    }
}
