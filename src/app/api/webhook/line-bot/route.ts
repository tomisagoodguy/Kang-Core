import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { WebhookEvent, WebhookRequestBody, validateSignature } from "@line/bot-sdk";
import { messageService } from "@/services/message.service";

export async function POST(req: Request) {
    // 1. 取得原始 body（簽章驗證需要未解析的原始字串）
    const rawBody = await req.text();
    const signature = req.headers.get("x-line-signature") ?? "";
    const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";

    // 2. 驗證 LINE 簽章，防止偽造 Webhook 事件
    if (!validateSignature(rawBody, channelSecret, signature)) {
        console.warn("[Webhook] Invalid signature — rejected");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    // 3. 解析 JSON body
    let body: WebhookRequestBody;
    try {
        body = JSON.parse(rawBody) as WebhookRequestBody;
    } catch {
        return NextResponse.json({ status: "bad_request" }, { status: 400 });
    }

    const events: WebhookEvent[] = body.events || [];

    // 立刻回 200 OK，waitUntil 確保 Vercel 等事件處理完畢
    waitUntil(Promise.all(events.map(event => messageService.processEvent(event))));

    return NextResponse.json({ status: "ok" });
}
