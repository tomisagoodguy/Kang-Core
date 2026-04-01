import { google } from "googleapis";

export interface GCalEvent {
    id: string;
    summary?: string;
    description?: string;
    start?: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
    };
    end?: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
    };
}

function getCalendarClient() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID?.trim(),
        process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),
        "http://localhost"
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim(),
    });

    return google.calendar({ version: "v3", auth: oauth2Client });
}

export async function getEventsFromGoogleCalendar(dateStr: string): Promise<GCalEvent[]> {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    const timeMin = new Date(`${dateStr}T00:00:00+08:00`).toISOString();
    const timeMax = new Date(`${dateStr}T23:59:59+08:00`).toISOString();

    try {
        const res = await calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: "startTime",
        });

        return (res.data.items as GCalEvent[]) || [];
    } catch (e) {
        const error = e as Error;
        console.error("Failed to fetch events from Google Calendar:", error.message || error);
        return [];
    }
}

export async function getUpcomingEventsFromGoogleCalendar(days: number = 7): Promise<GCalEvent[]> {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    const now = new Date();
    const timeMin = now.toISOString();

    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const timeMax = future.toISOString();

    try {
        const res = await calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            maxResults: 50,
            singleEvents: true,
            orderBy: "startTime",
        });

        return (res.data.items as GCalEvent[]) || [];
    } catch (e) {
        const error = e as Error;
        console.error("Failed to fetch upcoming events from Google Calendar:", error.message || error);
        return [];
    }
}

export async function getMonthlyEventsFromGoogleCalendar(year: number, month: number): Promise<GCalEvent[]> {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    // month is 1-12
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const timeMin = startDate.toISOString();
    const timeMax = endDate.toISOString();

    try {
        const res = await calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            maxResults: 200,
            singleEvents: true,
            orderBy: "startTime",
        });

        return (res.data.items as GCalEvent[]) || [];
    } catch (e) {
        const error = e as Error;
        console.error("Failed to fetch monthly events from Google Calendar:", error.message || error);
        return [];
    }
}

export async function addEventToGoogleCalendar(entry: {
    title: string;
    description?: string;
    actionDate?: string; // YYYY-MM-DD
    actionTime?: string; // HH:mm
}): Promise<string | null> {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    // 判斷是否有具體時間
    const hasTime = !!entry.actionTime;

    // 如果沒有 date，預設為明天 (依使用者邏輯)
    const dateStr = entry.actionDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    let start: Record<string, string> = {};
    let end: Record<string, string> = {};

    if (hasTime) {
        // 設定精確時間
        const dateTimeStr = `${dateStr}T${entry.actionTime}:00+08:00`; // 假設為 Asia/Taipei
        start = { dateTime: dateTimeStr, timeZone: "Asia/Taipei" };

        // 預設事件長度為 1 小時
        const endDate = new Date(new Date(dateTimeStr).getTime() + 60 * 60 * 1000);
        end = { dateTime: endDate.toISOString().replace(".000Z", "+00:00"), timeZone: "Asia/Taipei" }; // Convert back to proper string if needed, or just let API handle offset
    } else {
        // 全天事件
        start = { date: dateStr };
        // Google Calendar 全天事件的 end date 不包含在內，所以要加一天
        const nextDay = new Date(new Date(dateStr).getTime() + 86400000);
        end = { date: nextDay.toISOString().slice(0, 10) };
    }

    try {
        const res = await calendar.events.insert({
            calendarId,
            requestBody: {
                summary: entry.title,
                description: entry.description || "Added via LINE Bot",
                start,
                end,
            },
        });
        return res.data.id || null;
    } catch (e) {
        const error = e as Error;
        console.error("Failed to add event to Google Calendar:", error.message || error);
        return null; // Don't crash the whole bot
    }
}

export async function deleteEventFromGoogleCalendar(eventId: string): Promise<boolean> {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    try {
        await calendar.events.delete({
            calendarId,
            eventId,
        });
        return true;
    } catch (e) {
        const error = e as Error;
        console.error("Failed to delete event from Google Calendar", error.message || error);
        return false;
    }
}
