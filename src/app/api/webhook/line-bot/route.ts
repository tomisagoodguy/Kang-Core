import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { WebhookEvent, WebhookRequestBody } from "@line/bot-sdk";
import { messageService } from "@/services/message.service";

export async function POST(req: Request) {
    let body: WebhookRequestBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ status: "bad_request" }, { status: 400 });
    }

    const events: WebhookEvent[] = body.events || [];

    // 立刻回 200 OK，waitUntil 確保 Vercel 等事件處理完畢
    waitUntil(Promise.all(events.map(event => messageService.processEvent(event))));

    return NextResponse.json({ status: "ok" });
}
