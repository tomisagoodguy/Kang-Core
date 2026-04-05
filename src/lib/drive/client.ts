import { google } from "googleapis";
import { Readable } from "stream";

function getDriveClient() {
    // 使用個人的 OAuth2 憑證，配額算在你的個人帳號上，可上傳到 My Drive
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID?.trim(),
        process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),
        "http://localhost"
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim(),
    });

    return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * 取得（或建立）雲端硬碟中的子資料夾 ID
 */
async function getOrCreateSubfolder(
    drive: ReturnType<typeof google.drive>,
    parentFolderId: string,
    folderName: string
): Promise<string> {
    // 先查找是否已存在
    const res = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
        fields: "files(id)",
    });

    if (res.data.files && res.data.files.length > 0) {
        return res.data.files[0].id!;
    }

    // 不存在則建立
    const folder = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentFolderId],
        },
        fields: "id",
    });

    return folder.data.id!;
}

/**
 * 上傳檔案 (圖片或一般檔案) 到 Google Drive，自動按月分類存放
 * 路徑：{parentFolder}/{subfolder}/{YYYY-MM}/{filename}
 */
export async function uploadFileToDrive(
    fileBuffer: Buffer,
    filename: string,
    subfolder: string = "archive",
    mimeType?: string
): Promise<string> {
    const drive = getDriveClient();
    const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

    // 第一層：功能子資料夾（e.g. "archive"）
    const subFolderId = await getOrCreateSubfolder(drive, parentFolderId, subfolder);

    // 第二層：年月資料夾（e.g. "2026-03"）
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthFolderId = await getOrCreateSubfolder(drive, subFolderId, yearMonth);

    // 上傳檔案
    const stream = Readable.from(fileBuffer);

    const uploadRes = await drive.files.create({
        requestBody: {
            name: filename,
            parents: [monthFolderId],
        },
        media: {
            mimeType,
            body: stream,
        },
        fields: "id",
    });

    const fileId = uploadRes.data.id!;

    // 設定為任何人可讀取（不需要登入）
    await drive.permissions.create({
        fileId,
        requestBody: {
            role: "reader",
            type: "anyone",
        },
    });

    return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/**
 * 列出 Google Drive 中最近上傳的檔案（依修改時間倒序）
 * @param limit 回傳筆數，預設 5
 */
export async function listRecentDriveFiles(limit: number = 5): Promise<{
    name: string;
    modifiedTime: string;
    url: string;
}[]> {
    const drive = getDriveClient();
    const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

    const res = await drive.files.list({
        q: `'${parentFolderId}' in parents or '${parentFolderId}' in ancestors and mimeType != 'application/vnd.google-apps.folder' and trashed=false`,
        orderBy: "modifiedTime desc",
        pageSize: limit,
        fields: "files(id, name, modifiedTime)",
    });

    return (res.data.files ?? []).map((f) => ({
        name: f.name ?? "未知檔名",
        modifiedTime: f.modifiedTime ?? "",
        url: `https://drive.google.com/uc?export=view&id=${f.id}`,
    }));
}
