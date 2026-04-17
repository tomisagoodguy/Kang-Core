import { messagingApi } from "@line/bot-sdk";

export class LineService {
    private client: messagingApi.MessagingApiClient;
    private blobClient: messagingApi.MessagingApiBlobClient;

    constructor() {
        const config = {
            channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
        };
        this.client = new messagingApi.MessagingApiClient(config);
        this.blobClient = new messagingApi.MessagingApiBlobClient(config);
    }

    async replyText(replyToken: string, text: string): Promise<void> {
        await this.client.replyMessage({
            replyToken,
            messages: [{ type: "text", text }]
        });
    }

    async pushText(userId: string, text: string): Promise<void> {
        await this.client.pushMessage({
            to: userId,
            messages: [{ type: "text", text }]
        });
    }

    async showLoadingAnimation(userId: string, loadingSeconds = 10): Promise<void> {
        await this.client.showLoadingAnimation({ chatId: userId, loadingSeconds });
    }

    async getMessageContentBuffer(messageId: string): Promise<Buffer> {
        const stream = await this.blobClient.getMessageContent(messageId);
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            stream.on("data", (chunk: Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            stream.on("end", () => resolve(Buffer.concat(chunks)));
            stream.on("error", reject);
        });
    }
}

export const lineService = new LineService();
