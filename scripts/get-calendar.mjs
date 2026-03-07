import { getUpcomingEventsFromGoogleCalendar } from "../src/lib/calendar/client.ts";

async function main() {
    const events = await getUpcomingEventsFromGoogleCalendar();
    console.log(JSON.stringify(events, null, 2));
}

main();
