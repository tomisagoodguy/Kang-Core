import { google } from "googleapis";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

console.log("CLIENT ID:", process.env.GOOGLE_OAUTH_CLIENT_ID);

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    "http://localhost"
);

oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
});

const drive = google.drive({ version: "v3", auth: oauth2Client });

async function test() {
    try {
        const res = await drive.files.list({
            pageSize: 1,
            fields: "files(name)",
        });
        console.log("Success:", res.data.files);
    } catch (e) {
        console.error("❌ 發生例外:", e.message || e);
    }
}

test();
