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

// ─── 讀取（電子發票同步用，需 refresh token 含 gmail.readonly scope）───────

export interface GmailAttachmentRef {
    filename: string;
    attachmentId?: string;
    /** 小附件會直接內嵌在 message payload（base64url） */
    inlineData?: string;
}

/** 取得授權帳號的 email（用於 EMAIL_LINE_MAP 反查 LINE userId） */
export async function getAuthorizedEmail(): Promise<string> {
    const gmail = getGmailClient();
    const profile = await gmail.users.getProfile({ userId: "me" });
    return profile.data.emailAddress ?? "";
}

/** 依 Gmail 搜尋語法列出符合的 message id */
export async function listMessageIds(query: string, maxResults = 50): Promise<string[]> {
    const gmail = getGmailClient();
    const res = await gmail.users.messages.list({ userId: "me", q: query, maxResults });
    return (res.data.messages ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
}

/** 取出一封信中所有 csv/txt/zip 附件的參照（遞迴掃 multipart） */
export async function getInvoiceAttachmentRefs(messageId: string): Promise<GmailAttachmentRef[]> {
    const gmail = getGmailClient();
    const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });

    type Part = {
        filename?: string | null;
        body?: { attachmentId?: string | null; data?: string | null } | null;
        parts?: Part[] | null;
    };

    const collect = (part: Part | undefined | null): GmailAttachmentRef[] => {
        if (!part) return [];
        const nested = (part.parts ?? []).flatMap(collect);
        const filename = part.filename?.trim() ?? "";
        if (/\.(csv|txt|zip)$/i.test(filename)) {
            return [
                {
                    filename,
                    attachmentId: part.body?.attachmentId ?? undefined,
                    inlineData: part.body?.data ?? undefined,
                },
                ...nested,
            ];
        }
        return nested;
    };

    return collect(res.data.payload as Part | undefined);
}

/** 下載附件內容為 bytes */
export async function getAttachmentBytes(messageId: string, ref: GmailAttachmentRef): Promise<Uint8Array> {
    if (ref.inlineData) {
        return new Uint8Array(Buffer.from(ref.inlineData, "base64url"));
    }
    if (!ref.attachmentId) {
        throw new Error(`附件 ${ref.filename} 缺少 attachmentId`);
    }
    const gmail = getGmailClient();
    const res = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId,
        id: ref.attachmentId,
    });
    if (!res.data.data) {
        throw new Error(`附件 ${ref.filename} 下載失敗`);
    }
    return new Uint8Array(Buffer.from(res.data.data, "base64url"));
}
