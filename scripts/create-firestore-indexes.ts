import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import * as path from "path";
import * as https from "https";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID!;
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL!;
const PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({ projectId: PROJECT_ID, clientEmail: CLIENT_EMAIL, privateKey: PRIVATE_KEY }),
    });
}

const INDEXES = [
    {
        name: "userId(ASC) + createdAt(DESC)",
        fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "createdAt", order: "DESCENDING" },
        ],
    },
    {
        name: "userId(ASC) + tag(ASC) + createdAt(DESC)",
        fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "tag", order: "ASCENDING" },
            { fieldPath: "createdAt", order: "DESCENDING" },
        ],
    },
];

async function getAccessToken(): Promise<string> {
    const token = await admin.app().options.credential!.getAccessToken();
    return token.access_token;
}

async function createIndex(accessToken: string, fields: object[]): Promise<string> {
    const body = JSON.stringify({
        queryScope: "COLLECTION",
        fields,
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: "firestore.googleapis.com",
            path: `/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/accounting/indexes`,
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
            },
        };

        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(data));
        });

        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

async function listIndexes(accessToken: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "firestore.googleapis.com",
            path: `/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/accounting/indexes`,
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` },
        };

        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(data));
        });

        req.on("error", reject);
        req.end();
    });
}

async function main() {
    console.log(`專案：${PROJECT_ID}\n`);
    const accessToken = await getAccessToken();

    // 先列出現有索引
    console.log("查詢現有索引...");
    const existing = JSON.parse(await listIndexes(accessToken));
    const existingFields = (existing.indexes || []).map((idx: any) =>
        (idx.fields || []).map((f: any) => `${f.fieldPath}:${f.order}`).join("+")
    );
    console.log(`現有索引數量：${existingFields.length}`);

    for (const idx of INDEXES) {
        const key = idx.fields.map((f) => `${f.fieldPath}:${f.order}`).join("+");
        if (existingFields.includes(key)) {
            console.log(`✓ 已存在：${idx.name}`);
            continue;
        }

        console.log(`建立索引：${idx.name} ...`);
        const result = JSON.parse(await createIndex(accessToken, idx.fields));

        if (result.error) {
            if (result.error.code === 409) {
                console.log(`✓ 已存在（衝突）：${idx.name}`);
            } else {
                console.error(`✗ 失敗：${idx.name}`, result.error.message);
            }
        } else {
            console.log(`✓ 已提交：${idx.name}`);
            console.log(`  狀態：${result.state || "CREATING"}`);
            console.log(`  操作 ID：${result.name?.split("/").pop()}`);
        }
    }

    console.log("\n索引建立後需要數分鐘才能生效。");
}

main().catch(console.error);
