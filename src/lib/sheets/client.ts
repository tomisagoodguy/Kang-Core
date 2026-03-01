import { google } from "googleapis";

/**
 * Google Sheets API Client
 * 使用 Service Account 認證（與 Drive、Calendar 同一個帳號）
 *
 * 環境變數需求：
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL
 * - GOOGLE_PRIVATE_KEY
 * - GOOGLE_SHEETS_ID  (試算表的 spreadsheetId)
 */
function getSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
}

export interface SheetRow {
    date: string;
    amount: number;
    tag: string;
    subTag?: string;
    description?: string;
    source: string;
}

/**
 * 將資料寫入 Google Sheet，以 YYYY-MM 為 tab 名稱
 * 若 tab 不存在則自動建立；若已存在則清空後重寫
 */
export async function exportToSheet(sheetName: string, rows: SheetRow[]): Promise<string> {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID 環境變數未設定");

    const sheets = getSheetsClient();

    // 1. 取得所有 sheets 清單
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheet = meta.data.sheets?.find(
        s => s.properties?.title === sheetName
    );

    if (!existingSheet) {
        // 建立新 tab
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{
                    addSheet: {
                        properties: { title: sheetName }
                    }
                }]
            }
        });
    } else {
        // 清空現有 tab
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `${sheetName}!A:Z`,
        });
    }

    // 2. 組建資料（含表頭）
    const headers = ["日期", "金額", "標籤", "子標籤", "說明", "來源"];
    const data: (string | number)[][] = [
        headers,
        ...rows.map(r => [r.date, r.amount, r.tag, r.subTag || "", r.description || "", r.source]),
    ];

    // 3. 寫入資料
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: data },
    });

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}
