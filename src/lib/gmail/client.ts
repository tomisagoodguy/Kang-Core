import { google } from "googleapis";

function getGmailClient() {
    // 與 drive/calendar 共用同一組個人 OAuth2 憑證，需 refresh token 含 gmail.send scope
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID?.trim(),
        process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),
        "http://localhost"
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim(),
    });

    return google.gmail({ version: "v1", auth: oauth2Client });
}

/** RFC 2047 編碼，讓非 ASCII 主旨（中文）在各郵件客戶端正確顯示 */
function encodeSubject(subject: string): string {
    return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

/**
 * 以授權帳號（"me"）寄出 HTML 郵件。
 * @param to 收件者 email
 * @param subject 主旨（支援中文）
 * @param html HTML 內容
 */
export async function sendHtmlEmail(to: string, subject: string, html: string): Promise<void> {
    const gmail = getGmailClient();

    const message = [
        `To: ${to}`,
        `Subject: ${encodeSubject(subject)}`,
        "MIME-Version: 1.0",
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from(html, "utf-8").toString("base64"),
    ].join("\r\n");

    await gmail.users.messages.send({
        userId: "me",
        requestBody: {
            raw: Buffer.from(message, "utf-8").toString("base64url"),
        },
    });
}
