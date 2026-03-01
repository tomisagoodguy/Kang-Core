import { Client } from "@line/bot-sdk";

export class LineService {
    private client: Client;

    constructor() {
        this.client = new Client({
            channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
            channelSecret: process.env.LINE_CHANNEL_SECRET || "",
        });
    }

    async replyText(replyToken: string, text: string): Promise<void> {
        await this.client.replyMessage(replyToken, { type: "text", text });
    }

    async pushText(userId: string, text: string): Promise<void> {
        await this.client.pushMessage(userId, { type: "text", text });
    }

    async getMessageContentBuffer(messageId: string): Promise<Buffer> {
        const stream = await this.client.getMessageContent(messageId);
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            stream.on("data", (chunk: Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            stream.on("end", () => resolve(Buffer.concat(chunks)));
            stream.on("error", reject);
        });
    }
}

export const lineService = new LineService();
