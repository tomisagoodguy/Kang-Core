import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import { GeminiParseResult } from "@/models/schema";
import { safeExecute } from "./client";
import { ArchiveTagEngine } from "@/services/archiveTagEngine";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const MOCK_AI = process.env.MOCK_AI === "true";

// ─── Schema for Gemini models (support responseSchema) ───────────────────────
const outputSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        type: {
            type: SchemaType.STRING,
            description: "Must be one of: 'accounting', 'archive', 'calendar', 'recurring', 'query', 'clear_memory', 'unknown'",
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
                    description: "One of: Food, Transport, Entertainment, Utilities, Shopping, Health, Education, Income, Other",
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
        accountingDataList: {
            type: SchemaType.ARRAY,
            description: "Populate ONLY if type is 'accounting' and user provides MULTIPLE expenses",
            nullable: true,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    amount: { type: SchemaType.NUMBER, nullable: false },
                    tag: { type: SchemaType.STRING },
                    subTag: { type: SchemaType.STRING, nullable: true },
                    date: { type: SchemaType.STRING },
                    description: { type: SchemaType.STRING, nullable: true },
                },
                required: ["amount", "tag", "date"],
            }
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
        recurringData: {
            type: SchemaType.OBJECT,
            description: "Populate ONLY if type is 'recurring'",
            nullable: true,
            properties: {
                amount: { type: SchemaType.NUMBER, nullable: false },
                tag: { type: SchemaType.STRING, description: "e.g. Food, Utilities..." },
                description: { type: SchemaType.STRING, nullable: false, description: "Title/description of the recurring expense" },
                frequency: { type: SchemaType.STRING, description: "One of: 'daily', 'weekly', 'monthly', 'yearly'" },
                dayOfMonth: { type: SchemaType.NUMBER, nullable: true, description: "1-31. Populate if frequency is monthly or yearly" },
                dayOfWeek: { type: SchemaType.NUMBER, nullable: true, description: "0-6 (Sun-Sat). Populate if frequency is weekly" },
            },
            required: ["amount", "tag", "description", "frequency"],
        },
        queryData: {
            type: SchemaType.OBJECT,
            description: "Populate ONLY if type is 'query'. For data retrieval requests.",
            nullable: true,
            properties: {
                queryType: {
                    type: SchemaType.STRING,
                    description: "One of: 'expense', 'archive', 'calendar', 'semantic_search'",
                },
                tag: { type: SchemaType.STRING, nullable: true, description: "Filter by tag (e.g. Food, Transport)" },
                period: {
                    type: SchemaType.STRING,
                    nullable: true,
                    description: "One of: 'this_month', 'last_month', 'this_week', 'last_week', 'today', 'tomorrow'",
                },
                limit: { type: SchemaType.NUMBER, nullable: true, description: "Number of results (default 5)" },
                semanticQuery: { type: SchemaType.STRING, nullable: true, description: "Detailed string of what the user is looking for in their notes/archive, e.g. '如何學鋼琴'" },
            },
            required: ["queryType"],
        },
    },
    required: ["type"],
};

// ─── System prompt for Gemma models (prompt-based JSON, no responseSchema) ───
const TODAY = () => new Date().toISOString().split("T")[0];

const SYSTEM_PROMPT = (archiveTags: string[]) =>
    `You are an AI assistant for Kang-Core. Today is ${TODAY()}.
Analyze the user input and respond ONLY with a valid JSON object. No markdown, no explanation, just the JSON.

JSON schema:
{
  "type": "accounting" | "archive" | "calendar" | "recurring" | "query" | "clear_memory" | "unknown",
  "explanation": "string (brief reason)",
  "accountingData": { "amount": number, "tag": "...", "subTag": "...", "date": "YYYY-MM-DD", "description": "string" },
  "accountingDataList": [ { "amount": number, "tag": "...", "subTag": "...", "date": "YYYY-MM-DD", "description": "string" } ],
  "archiveData": { "url": "...", "title": "...", "summary": "...", "keywords": ["..."] },
  "calendarData": { "title": "...", "actionDate": "YYYY-MM-DD", "actionTime": "HH:mm", "description": "..." },
  "recurringData": { "amount": number, "tag": "...", "description": "...", "frequency": "monthly", "dayOfMonth": 10 },
  "queryData": { "queryType": "expense" | "archive" | "calendar" | "semantic_search", "tag": "...", "period": "this_month" | "last_month" | "this_week" | "last_week" | "today" | "tomorrow", "limit": 5, "semanticQuery": "..." }
}

Rules:
- If user mentions spending money, food, transport, shopping, tracking expense, or earning money, salary, receiving cash → type = "accounting", fill accountingData (For income, set tag to 'Income'). If user inputs MULTIPLE expenses in one sentence (e.g. "健身50沙拉95"), fill 'accountingDataList' with multiple items instead.
- If user wants to schedule, plan, remind, to-do → type = "calendar", fill calendarData
- If user wants to set up a regular, fixed, or scheduled expense (e.g. 每個月10號付錢, 每週花多少) → type = "recurring", fill recurringData
- If user shares a link, article, note, or general knowledge → type = "archive", fill archiveData
- If user is ASKING/QUERYING about their data (e.g. "這個月吃飯花多少", "上週花了多少", "最近收藏了什麼", "明天有什麼事") → type = "query", fill queryData (use queryType "expense", "archive", "calendar" respectively).
- If user is ASKING a complex semantic question about their notes/knowledge (e.g. "之前存過哪些AI相關的文章？", "幫我找關於財務自由的觀念") → type = "query", queryType = "semantic_search", fill 'semanticQuery'.
- If user wants to clear or reset the conversational memory (e.g. "清除對話", "reset", "clear", "重置") → type = "clear_memory"
- Otherwise → type = "unknown"
- For dates, use today (${TODAY()}) as reference. Tomorrow is ${new Date(Date.now() + 86400000).toISOString().split("T")[0]}.
- CRITICAL: MUST use Traditional Chinese (繁體中文) for 'summary' and 'keywords' arrays.
- CRITICAL TIP: User has existing fixed monthly expenses on the 10th: "家裡伙食費" (amount: 7000, tag: "Food"), "電話費" (amount: 488, tag: "Utilities"). If the user mentions setting these up, or paying them without an amount, YOU CAN INFER the amount and description.
- For archive keywords, priorities choosing from these frequently used tags if applicable: [${archiveTags.join(", ")}]. You may create new ones ONLY if these don't fit well.
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

async function tryGeminiModel(modelName: string, text: string, archiveTags: string[], historyContext?: string): Promise<GeminiParseResult> {
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: `You are an AI assistant that parses user intent for the Kang-Core system. Today is ${TODAY()}. CRITICAL: MUST use Traditional Chinese (繁體中文) for 'summary', 'keywords', and any explanation. For archive keywords, please prioritize these: ${archiveTags.join(", ")}.\n\nRecent conversational history (for context only, if applicable):\n${historyContext || "None"}`,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: outputSchema,
        },
    });
    const result = await safeExecute(() => model.generateContent(text));
    const parsed = JSON.parse(result.response.text()) as GeminiParseResult;
    return { ...parsed, isError: false };
}

async function tryGemmaModel(modelName: string, text: string, archiveTags: string[], historyContext?: string): Promise<GeminiParseResult> {
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `${SYSTEM_PROMPT(archiveTags)}\n\nRecent conversational history (for context only, if applicable):\n${historyContext || "None"}\n\nUser input: "${text}"`;
    const result = await safeExecute(() => model.generateContent(prompt));
    const raw = result.response.text().trim();

    // Extract JSON from response (Gemma might wrap it in markdown)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in Gemma response");

    const parsed = JSON.parse(jsonMatch[0]) as GeminiParseResult;
    return { ...parsed, isError: false };
}

export async function parseUserInput(text: string, historyContext?: string): Promise<GeminiParseResult> {
    if (MOCK_AI) {
        console.log(`[MOCK MODE] Parsing: "${text}", History length: ${historyContext?.length || 0}`);
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

    // 取得最常用的標籤供 AI 選擇
    const archiveTags = await ArchiveTagEngine.getTopKeywords(15);

    // 第一輪：Gemini models（支援 responseSchema，輸出最穩定）
    for (const modelName of GEMINI_MODELS) {
        try {
            console.log(`[AI] Trying Gemini: ${modelName}`);
            const result = await tryGeminiModel(modelName, text, archiveTags, historyContext);
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
            const result = await tryGemmaModel(modelName, text, archiveTags, historyContext);
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
