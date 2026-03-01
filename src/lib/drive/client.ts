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
 * 上傳檔案 (圖片或一般檔案) 到 Google Drive，回傳公開可讀取的 URL
 */
export async function uploadFileToDrive(
    fileBuffer: Buffer,
    filename: string,
    subfolder: string = "archive",
    mimeType?: string
): Promise<string> {
    const drive = getDriveClient();
    const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

    // 取得或建立子資料夾
    const subFolderId = await getOrCreateSubfolder(drive, parentFolderId, subfolder);

    // 上傳檔案
    const stream = Readable.from(fileBuffer);
    const media: any = { body: stream };
    if (mimeType) {
        media.mimeType = mimeType;
    }

    const uploadRes = await drive.files.create({
        requestBody: {
            name: filename,
            parents: [subFolderId],
        },
        media,
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
