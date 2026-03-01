import { addEventToGoogleCalendar, deleteEventFromGoogleCalendar } from "../src/lib/calendar/client";
import { config } from "dotenv";

config({ path: ".env.local" });

async function test() {
    console.log("Testing Google Calendar...");
    try {
        const id = await addEventToGoogleCalendar({
            title: "測試 Kang-Core LINE Bot",
            description: "這是一則測試訊息，如果看到這個代表功能正常運作中！",
            actionDate: new Date().toISOString().slice(0, 10),
            actionTime: "12:00"
        });
        if (id) {
            console.log("✅ 成功建立行事曆事件，ID:", id);
            console.log("刪除測試事件...");
            const deleted = await deleteEventFromGoogleCalendar(id);
            if (deleted) {
                console.log("✅ 成功刪除測試事件");
            } else {
                console.log("❌ 刪除測試事件失敗");
            }
        } else {
            console.log("❌ 建立行事曆事件失敗 (回傳 null)");
        }
    } catch (e: any) {
        console.error("❌ 發生例外:", e.message || e);
    }
}

test();
