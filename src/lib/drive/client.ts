import { google } from "googleapis";
import { Readable } from "stream";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

function getDriveClient() {
    const auth = new google.auth.JWT({
        email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
        key: (process.env.GOOGLE_DRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        scopes: SCOPES,
    });
    return google.drive({ version: "v3", auth });
}

/**
 * 取得（或建立）子資料夾 ID
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
 * 上傳圖片到 Google Drive，回傳公開可讀取的 URL
 */
export async function uploadImageToDrive(
    imageBuffer: Buffer,
    filename: string,
    subfolder: "receipts" | "screenshots"
): Promise<string> {
    const drive = getDriveClient();
    const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

    // 取得或建立子資料夾
    const subFolderId = await getOrCreateSubfolder(drive, parentFolderId, subfolder);

    // 上傳檔案
    const stream = Readable.from(imageBuffer);
    const uploadRes = await drive.files.create({
        requestBody: {
            name: filename,
            parents: [subFolderId],
        },
        media: {
            mimeType: "image/jpeg",
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
