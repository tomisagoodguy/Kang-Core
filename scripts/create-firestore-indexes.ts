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

interface IndexField {
    fieldPath: string;
    order: "ASCENDING" | "DESCENDING";
}

interface IndexDef {
    collection: string;
    name: string;
    fields: IndexField[];
}

const INDEXES: IndexDef[] = [
    // accounting
    {
        collection: "accounting",
        name: "accounting: userId(ASC) + date(ASC)",
        fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "date", order: "ASCENDING" },
        ],
    },
    // archive
    {
        collection: "archive",
        name: "archive: userId(ASC) + createdAt(DESC)",
        fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "createdAt", order: "DESCENDING" },
        ],
    },
    // calendar
    {
        collection: "calendar",
        name: "calendar: userId(ASC) + actionDate(ASC)",
        fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "actionDate", order: "ASCENDING" },
        ],
    },
    {
        collection: "calendar",
        name: "calendar: userId(ASC) + status(ASC)",
        fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "status", order: "ASCENDING" },
        ],
    },
    // insights
    {
        collection: "insights",
        name: "insights: userId(ASC) + createdAt(DESC)",
        fields: [
            { fieldPath: "userId", order: "ASCENDING" },
            { fieldPath: "createdAt", order: "DESCENDING" },
        ],
    },
];

async function getAccessToken(): Promise<string> {
    const token = await admin.app().options.credential!.getAccessToken();
    return token.access_token;
}

function apiRequest(method: string, urlPath: string, accessToken: string, body?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "firestore.googleapis.com",
            path: urlPath,
            method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
            },
        };

        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(data));
        });

        req.on("error", reject);
        if (body) req.write(body);
        req.end();
    });
}

async function getExistingIndexKeys(accessToken: string, collection: string): Promise<Set<string>> {
    const urlPath = `/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/${collection}/indexes`;
    const raw = await apiRequest("GET", urlPath, accessToken);
    const parsed = JSON.parse(raw);
    const keys = new Set<string>();
    for (const idx of parsed.indexes || []) {
        const key = (idx.fields || []).map((f: IndexField) => `${f.fieldPath}:${f.order}`).join("+");
        keys.add(key);
    }
    return keys;
}

async function createIndex(accessToken: string, collection: string, fields: IndexField[]): Promise<string> {
    const urlPath = `/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/${collection}/indexes`;
    const body = JSON.stringify({ queryScope: "COLLECTION", fields });
    return apiRequest("POST", urlPath, accessToken, body);
}

async function main() {
    console.log(`專案：${PROJECT_ID}\n`);
    const accessToken = await getAccessToken();

    // 依集合分組
    const byCollection = new Map<string, IndexDef[]>();
    for (const idx of INDEXES) {
        const list = byCollection.get(idx.collection) ?? [];
        list.push(idx);
        byCollection.set(idx.collection, list);
    }

    for (const [collection, indexes] of byCollection) {
        const existing = await getExistingIndexKeys(accessToken, collection);

        for (const idx of indexes) {
            const key = idx.fields.map(f => `${f.fieldPath}:${f.order}`).join("+");

            if (existing.has(key)) {
                console.log(`✓ 已存在：${idx.name}`);
                continue;
            }

            console.log(`建立索引：${idx.name} ...`);
            const result = JSON.parse(await createIndex(accessToken, collection, idx.fields));

            if (result.error) {
                if (result.error.code === 409) {
                    console.log(`✓ 已存在（衝突）：${idx.name}`);
                } else {
                    console.error(`✗ 失敗：${idx.name}`, result.error.message);
                }
            } else {
                console.log(`✓ 已提交：${idx.name}（狀態：${result.state ?? "CREATING"}）`);
            }
        }
    }

    console.log("\n索引建立後需要 1-5 分鐘才能生效。");
}

main().catch(console.error);
