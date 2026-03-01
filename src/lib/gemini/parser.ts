import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import { GeminiParseResult } from "@/models/schema";
import { safeExecute } from "./client";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const MOCK_AI = process.env.MOCK_AI === "true";

// ─── Schema for Gemini models (support responseSchema) ───────────────────────
const outputSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        type: {
            type: SchemaType.STRING,
            description: "Must be one of: 'accounting', 'archive', 'calendar', 'query', 'unknown'",
            nullable: false,
        },
        explanation: {
            type: SchemaType.STRING,
            description: "A short reasoning for this classification",
            nullable: true,
        },
        accountingData: {
            type: SchemaType.OBJECT,
            description: "Populate ONLY if type is 'accounting'",
            nullable: true,
            properties: {
                amount: { type: SchemaType.NUMBER, nullable: false },
                tag: {
                    type: SchemaType.STRING,
                    description: "One of: Food, Transport, Entertainment, Utilities, Shopping, Health, Education, Other",
                },
                subTag: {
                    type: SchemaType.STRING,
                    description: "Any specific sub-category if provided (e.g. Lunch, Coffee, Bus)",
                    nullable: true,
                },
                date: { type: SchemaType.STRING, description: "Format: YYYY-MM-DD" },
                description: { type: SchemaType.STRING, nullable: true },
            },
            required: ["amount", "tag", "date"],
        },
        archiveData: {
            type: SchemaType.OBJECT,
            description: "Populate ONLY if type is 'archive'",
            nullable: true,
            properties: {
                url: { type: SchemaType.STRING, nullable: true },
                title: { type: SchemaType.STRING, nullable: true },
                summary: { type: SchemaType.STRING, nullable: false },
                keywords: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                },
                imageUrl: { type: SchemaType.STRING, nullable: true },
            },
            required: ["summary", "keywords"],
        },
        calendarData: {
            type: SchemaType.OBJECT,
            description: "Populate ONLY if type is 'calendar'",
            nullable: true,
            properties: {
                title: { type: SchemaType.STRING, nullable: false, description: "What to do" },
                actionDate: { type: SchemaType.STRING, nullable: true, description: "YYYY-MM-DD" },
                actionTime: { type: SchemaType.STRING, nullable: true, description: "HH:mm in 24h format" },
                description: { type: SchemaType.STRING, nullable: true },
            },
            required: ["title"],
        },
        queryData: {
            type: SchemaType.OBJECT,
            description: "Populate ONLY if type is 'query'. For data retrieval requests.",
            nullable: true,
            properties: {
                queryType: {
                    type: SchemaType.STRING,
                    description: "One of: 'expense', 'archive', 'calendar'",
                },
                tag: { type: SchemaType.STRING, nullable: true, description: "Filter by tag (e.g. Food, Transport)" },
                period: {
                    type: SchemaType.STRING,
                    nullable: true,
                    description: "One of: 'this_month', 'last_month', 'this_week', 'last_week', 'today', 'tomorrow'",
                },
                limit: { type: SchemaType.NUMBER, nullable: true, description: "Number of results (default 5)" },
            },
            required: ["queryType"],
        },
    },
    required: ["type"],
};

// ─── System prompt for Gemma models (prompt-based JSON, no responseSchema) ───
const TODAY = () => new Date().toISOString().split("T")[0];

const SYSTEM_PROMPT = () =>
    `You are an AI assistant for Kang-Core. Today is ${TODAY()}.
Analyze the user input and respond ONLY with a valid JSON object. No markdown, no explanation, just the JSON.

JSON schema:
{
  "type": "accounting" | "archive" | "calendar" | "query" | "unknown",
  "explanation": "string (brief reason)",
  "accountingData": { "amount": number, "tag": "...", "subTag": "...", "date": "YYYY-MM-DD", "description": "string" },
  "archiveData": { "url": "...", "title": "...", "summary": "...", "keywords": ["..."] },
  "calendarData": { "title": "...", "actionDate": "YYYY-MM-DD", "actionTime": "HH:mm", "description": "..." },
  "queryData": { "queryType": "expense" | "archive" | "calendar", "tag": "...", "period": "this_month" | "last_month" | "this_week" | "last_week" | "today" | "tomorrow", "limit": 5 }
}

Rules:
- If user mentions spending money, food, transport, shopping → type = "accounting", fill accountingData
- If user wants to schedule, plan, remind, to-do → type = "calendar", fill calendarData
- If user shares a link, article, note, or general knowledge → type = "archive", fill archiveData
- If user is ASKING/QUERYING about their data (e.g. "這個月吃飯花多少", "上週花了多少", "最近收藏了什麼", "明天有什麼事") → type = "query", fill queryData
- Otherwise → type = "unknown"
- For dates, use today (${TODAY()}) as reference. Tomorrow is ${new Date(Date.now() + 86400000).toISOString().split("T")[0]}.
- ONLY output valid JSON, nothing else`;

// ─── Gemini models (support responseSchema) ───────────────────────────────────
const GEMINI_MODELS = [
    "gemini-3-flash-preview",   // Gemini 3 Flash，20 RPD
    "gemini-2.5-flash-lite",    // Gemini 2.5 Flash-Lite，20 RPD
    "gemini-2.5-flash",         // Gemini 2.5 Flash，20 RPD（備援）
];

// ─── Gemma models (14,400 RPD each! prompt-based JSON) ───────────────────────
const GEMMA_MODELS = [
    "gemma-3-27b-it",   // 最強 Gemma，理解力最好
    "gemma-3-12b-it",
    "gemma-3-4b-it",
    "gemma-3-2b-it",
    "gemma-3-1b-it",    // 最輕量備援
];

async function tryGeminiModel(modelName: string, text: string): Promise<GeminiParseResult> {
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: `You are an AI assistant that parses user intent for the Kang-Core system. Today is ${TODAY()}.`,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: outputSchema,
        },
    });
    const result = await safeExecute(() => model.generateContent(text));
    const parsed = JSON.parse(result.response.text()) as GeminiParseResult;
    return { ...parsed, isError: false };
}

async function tryGemmaModel(modelName: string, text: string): Promise<GeminiParseResult> {
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `${SYSTEM_PROMPT()}\n\nUser input: "${text}"`;
    const result = await safeExecute(() => model.generateContent(prompt));
    const raw = result.response.text().trim();

    // Extract JSON from response (Gemma might wrap it in markdown)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in Gemma response");

    const parsed = JSON.parse(jsonMatch[0]) as GeminiParseResult;
    return { ...parsed, isError: false };
}

export async function parseUserInput(text: string): Promise<GeminiParseResult> {
    if (MOCK_AI) {
        console.log(`[MOCK MODE] Parsing: "${text}"`);
        const isMoney = /\d/.test(text) && (text.includes("買") || text.includes("吃") || text.includes("花"));
        if (isMoney) {
            return {
                type: "accounting",
                isError: false,
                accountingData: {
                    amount: parseInt(text.match(/\d+/)![0], 10),
                    tag: "Other",
                    date: TODAY(),
                    description: text,
                },
                explanation: "Mock mode.",
            };
        }
        return {
            type: "archive",
            isError: false,
            archiveData: {
                url: text.startsWith("http") ? text : undefined,
                summary: `Archived: ${text}`,
                keywords: ["mock"],
            },
            explanation: "Mock mode.",
        };
    }

    let lastError: any = null;

    // 第一輪：Gemini models（支援 responseSchema，輸出最穩定）
    for (const modelName of GEMINI_MODELS) {
        try {
            console.log(`[AI] Trying Gemini: ${modelName}`);
            const result = await tryGeminiModel(modelName, text);
            console.log(`[AI] ✅ ${modelName} succeeded`);
            return result;
        } catch (err: any) {
            console.warn(`[AI] ❌ ${modelName} failed: ${err?.message}`);
            lastError = err;
        }
    }

    // 第二輪：Gemma models（14,400 RPD，prompt-based JSON）
    for (const modelName of GEMMA_MODELS) {
        try {
            console.log(`[AI] Trying Gemma: ${modelName}`);
            const result = await tryGemmaModel(modelName, text);
            console.log(`[AI] ✅ ${modelName} succeeded`);
            return result;
        } catch (err: any) {
            console.warn(`[AI] ❌ ${modelName} failed: ${err?.message}`);
            lastError = err;
        }
    }

    console.error(`[AI] All models exhausted. Last error:`, lastError);
    return {
        type: "unknown",
        isError: true,
        errorMessage: lastError instanceof Error ? lastError.message : "All AI models failed",
    };
}
