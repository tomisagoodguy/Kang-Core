import { getUpcomingEventsFromGoogleCalendar } from "../src/lib/calendar/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
    console.log("Fetching events...");
    const events = await getUpcomingEventsFromGoogleCalendar();
    console.log(JSON.stringify(events, null, 2));
}

main();
