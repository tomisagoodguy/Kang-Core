import { google } from "googleapis";

export interface GTask {
    id: string;
    title?: string;
    notes?: string;
    due?: string; // RFC3339, date-only (time part always T00:00:00.000Z)
    status?: string; // "needsAction" | "completed"
}

function getTasksClient() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID?.trim(),
        process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),
        "http://localhost"
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim(),
    });

    return google.tasks({ version: "v1", auth: oauth2Client });
}

/**
 * 取得某月份的 Google Tasks（依 due 日期篩選）。
 * Tasks API 沒有跨清單查詢，需先列出所有 tasklists 再逐一查詢。
 */
export async function getMonthlyGoogleTasks(year: number, month: number): Promise<GTask[]> {
    const tasksApi = getTasksClient();

    const dueMin = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const dueMax = new Date(Date.UTC(year, month, 0, 23, 59, 59)).toISOString();

    try {
        const listsRes = await tasksApi.tasklists.list({ maxResults: 100 });
        const taskLists = listsRes.data.items || [];

        const allTasks: GTask[] = [];
        for (const list of taskLists) {
            if (!list.id) continue;
            const res = await tasksApi.tasks.list({
                tasklist: list.id,
                dueMin,
                dueMax,
                showCompleted: true,
                showHidden: true,
                maxResults: 100,
            });
            allTasks.push(...((res.data.items as GTask[]) || []));
        }

        return allTasks;
    } catch (e) {
        const error = e as Error;
        console.error("Failed to fetch Google Tasks:", error.message || error);
        return [];
    }
}
