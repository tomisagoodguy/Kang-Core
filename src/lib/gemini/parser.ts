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
                amount: { type: SchemaType.NUMBER, nullable: false, description: "Amount in ORIGINAL currency the user actually paid" },
                tag: {
                    type: SchemaType.STRING,
                    description: "One of: Food, Transport, Entertainment, Utilities, Shopping, Health, Education, Insurance, Subscription, Investment, Travel, Income, Other",
                },
                subTag: {
                    type: SchemaType.STRING,
                    description: "Any specific sub-category if provided (e.g. Lunch, Coffee, Bus)",
                    nullable: true,
                },
                date: { type: SchemaType.STRING, description: "Format: YYYY-MM-DD" },
                description: { type: SchemaType.STRING, nullable: true },
                currency: { type: SchemaType.STRING, nullable: true, description: "ISO 4217 code (TWD/JPY/USD/EUR/KRW/THB/GBP/HKD/SGD/CNY...). Only set if user explicitly mentions a foreign currency (日幣/美金/歐元...). Otherwise leave null." },
                paymentMethod: { type: SchemaType.STRING, nullable: true, description: "One of: cash, credit_card, e_payment. Set from keywords (現金=cash; 刷卡/信用卡=credit_card; 悠遊卡/LinePay/街口/電子支付/行動支付=e_payment). Otherwise null." },
                settlement: {
                    type: SchemaType.OBJECT,
                    nullable: true,
                    description: "Only when this expense involves paying for someone else OR someone paying for the user (代墊/借錢/各付一半/我幫他付/他幫我付).",
                    properties: {
                        paidBy: { type: SchemaType.STRING, description: "'me' if the user paid up front, 'other' if someone else paid for the user" },
                        counterparty: { type: SchemaType.STRING, description: "The other person's name" },
                        myShare: { type: SchemaType.NUMBER, description: "The user's own portion in ORIGINAL currency (0 if user fully covered someone else). For 各付一半 it is amount/2." },
                    },
                    required: ["paidBy", "counterparty", "myShare"],
                },
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
                    currency: { type: SchemaType.STRING, nullable: true, description: "ISO 4217 code; only if foreign currency explicitly mentioned, else null" },
                    paymentMethod: { type: SchemaType.STRING, nullable: true, description: "cash | credit_card | e_payment, else null" },
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
  "accountingData": { "amount": number, "tag": "...", "subTag": "...", "date": "YYYY-MM-DD", "description": "string", "currency": "TWD|JPY|USD|...", "paymentMethod": "cash|credit_card|e_payment", "settlement": { "paidBy": "me|other", "counterparty": "string", "myShare": number } },
  "accountingDataList": [ { "amount": number, "tag": "...", "subTag": "...", "date": "YYYY-MM-DD", "description": "string", "currency": "...", "paymentMethod": "..." } ],
  "archiveData": { "url": "...", "title": "...", "summary": "...", "keywords": ["..."] },
  "calendarData": { "title": "...", "actionDate": "YYYY-MM-DD", "actionTime": "HH:mm", "description": "..." },
  "recurringData": { "amount": number, "tag": "...", "description": "...", "frequency": "monthly", "dayOfMonth": 10 },
  "queryData": { "queryType": "expense" | "archive" | "calendar" | "semantic_search", "tag": "...", "period": "this_month" | "last_month" | "this_week" | "last_week" | "today" | "tomorrow", "limit": 5, "semanticQuery": "..." }
}

Financial Concepts:
- Balance (結餘) = Income (收入) - Expenses (支出).
- IncomeTags: 'Income'
- ExpenseTags: 'Food', 'Transport', 'Entertainment', 'Utilities', 'Shopping', 'Health', 'Education', 'Insurance', 'Subscription', 'Investment', 'Travel', 'Other'
- Investment 用於：買股票、定期定額、ETF、基金、存股、證券下單等投資行為
- Subscription 用於：定期訂閱服務（YouTube Premium、ChatGPT、Claude、iCloud、Notion、Adobe 等月費/年費）
- Education 用於：才藝課、語言課、線上學習課（Hahow、Coursera 等）、補習費、學費
- Travel 用於：出國旅遊期間的所有消費，包含機票、eSIM、住宿（Airbnb/Agoda/hotel）、伴手禮、旅遊當地餐飲食物、景點門票、當地購物、行李箱、簽證費等。判斷依據：描述中有出國地名（日本、德國、東京、大阪、柏林等）或明確標示為旅遊消費。

Rules:
- If user mentions spending money, food, transport, shopping, insurance, health, tracking expense, or earning money, salary, receiving cash → type = "accounting", fill accountingData (For income, set tag to 'Income'). If user inputs MULTIPLE expenses in one sentence (e.g. "健身50沙拉95"), fill 'accountingDataList' with multiple items instead.
- Currency: 'amount' is ALWAYS the number the user literally said, in its ORIGINAL currency. Set 'currency' to an ISO 4217 code ONLY when the user explicitly names a foreign currency (日幣/円→JPY, 美金/美元/鎂→USD, 歐元/歐→EUR, 韓元→KRW, 泰銖/銖→THB, 英鎊→GBP, 港幣→HKD, 新加坡幣→SGD, 人民幣→CNY). Do NOT convert to TWD yourself and do NOT compute exchange rates — the server handles conversion. If no foreign currency is mentioned, leave currency null.
- Payment method: set 'paymentMethod' from keywords — 現金=cash; 刷卡/信用卡/卡=credit_card; 悠遊卡/一卡通/LinePay/Line Pay/街口/Apple Pay/電子支付/行動支付/嗶=e_payment. If none mentioned, leave null.
- Settlement (代墊/借貸): if the expense involves the user paying for others or others paying for the user, fill 'settlement'. "我幫小明付了X(各付一半)" → paidBy='me', counterparty='小明', myShare=X/2. "我幫小明全墊X" → paidBy='me', myShare=0. "小明先幫我付X" → paidBy='other', counterparty='小明', myShare=X. 'amount' stays the FULL amount paid at the register.
- If user asks about 'Balance' or 'Net Profit', they are asking for 'Income - Expenses' for a specific period.
- If user wants to schedule, plan, remind, to-do → type = "calendar", fill calendarData
- If user wants to set up a regular, fixed, or scheduled expense (e.g. 每個月10號付錢, 每週花多少) → type = "recurring", fill recurringData
- If user shares a link, article, note, or general knowledge → type = "archive", fill archiveData
- If user is ASKING/QUERYING about their data (e.g. "這個月吃飯花多少", "上週花了多少", "最近收藏了什麼", "明天有什麼事") → type = "query", fill queryData (use queryType "expense", "archive", "calendar" respectively).
- If user is ASKING a complex semantic question about their notes/knowledge (e.g. "之前存過哪些AI相關的文章？", "幫我找關於財務自由的觀念") → type = "query", queryType = "semantic_search", fill 'semanticQuery'.
- If user wants to clear or reset the conversational memory (e.g. "清除對話", "reset", "clear", "重置") → type = "clear_memory"
- Otherwise → type = "unknown"
- For dates, use today (${TODAY()}) as reference. Key relative dates: 昨天=${new Date(Date.now() - 86400000).toISOString().split("T")[0]}, 前天=${new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0]}, 大前天=${new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0]}, 明天=${new Date(Date.now() + 86400000).toISOString().split("T")[0]}. For dates like "X月Y號" or "X/Y", assume current year ${new Date().getFullYear()} (use last year if the resulting date is in the future).
- CRITICAL: MUST use Traditional Chinese (繁體中文) for 'summary' and 'keywords' arrays.
- CRITICAL TIP: User has existing fixed monthly expenses on the 10th: "家裡伙食費分攤" (amount: 7000, tag: "Utilities", description: "家裡伙食費分攤"), "電話費" (amount: 488, tag: "Utilities"). Note: "家裡伙食費" / "家裡伙食費分攤" / "家裡" + 金額 都是指房租性質的家庭分攤費用，一律用 tag: "Utilities"。If the user mentions setting these up, or paying them without an amount, YOU CAN INFER the amount and description.
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

async function tryGeminiModel(modelName: string, text: string, archiveTags: string[], historyContext?: string, travelContext?: { active: boolean; destination: string | null; currency?: string | null }): Promise<GeminiParseResult> {
    const travelInstruction = travelContext?.active
        ? `\n\n⚠️ TRAVEL MODE ACTIVE: User is currently traveling${travelContext.destination ? ` in ${travelContext.destination}` : ""}. ALL expenses (food, shopping, transport, entertainment, activities) MUST use tag='Travel'. Only keep original tags for: Utilities (house bills), Insurance, Subscription, Investment, Income.${travelContext.currency ? ` Local currency is ${travelContext.currency}; bare numbers are assumed ${travelContext.currency} (the server applies this), so leave 'currency' null unless the user names a DIFFERENT currency.` : ""}`
        : "";
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: `You are an AI assistant that parses user intent for the Kang-Core system. Today is ${TODAY()}. Key relative dates: 昨天=${new Date(Date.now() - 86400000).toISOString().split("T")[0]}, 前天=${new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0]}, 大前天=${new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0]}, 明天=${new Date(Date.now() + 86400000).toISOString().split("T")[0]}. For dates like "X月Y號" or "X/Y", assume year ${new Date().getFullYear()} (use last year if the date would be in the future). CRITICAL: MUST use Traditional Chinese (繁體中文) for 'summary', 'keywords', and any explanation. For archive keywords, please prioritize these: ${archiveTags.join(", ")}.${travelInstruction}\n\nRecent conversational history (for context only, if applicable):\n${historyContext || "None"}`,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: outputSchema,
        },
    });
    const result = await safeExecute(() => model.generateContent(text));
    const parsed = JSON.parse(result.response.text()) as GeminiParseResult;
    return { ...parsed, isError: false };
}

async function tryGemmaModel(modelName: string, text: string, archiveTags: string[], historyContext?: string, travelContext?: { active: boolean; destination: string | null; currency?: string | null }): Promise<GeminiParseResult> {
    const travelInstruction = travelContext?.active
        ? `\n\n⚠️ TRAVEL MODE ACTIVE: User is currently traveling${travelContext.destination ? ` in ${travelContext.destination}` : ""}. ALL expenses MUST use tag='Travel' except Utilities/Insurance/Subscription/Investment/Income.${travelContext.currency ? ` Local currency is ${travelContext.currency}; leave 'currency' null unless a different currency is named.` : ""}`
        : "";
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `${SYSTEM_PROMPT(archiveTags)}${travelInstruction}\n\nRecent conversational history (for context only, if applicable):\n${historyContext || "None"}\n\nUser input: "${text}"`;
    const result = await safeExecute(() => model.generateContent(prompt));
    const raw = result.response.text().trim();

    // Extract JSON from response (Gemma might wrap it in markdown)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in Gemma response");

    const parsed = JSON.parse(jsonMatch[0]) as GeminiParseResult;
    return { ...parsed, isError: false };
}

export async function parseUserInput(text: string, historyContext?: string, travelContext?: { active: boolean; destination: string | null; currency?: string | null }): Promise<GeminiParseResult> {
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

    let lastError: Error | null = null;

    // 取得最常用的標籤供 AI 選擇
    const archiveTags = await ArchiveTagEngine.getTopKeywords(15);

    // 第一輪：Gemini models（支援 responseSchema，輸出最穩定）
    for (const modelName of GEMINI_MODELS) {
        try {
            console.log(`[AI] Trying Gemini: ${modelName}`);
            const result = await tryGeminiModel(modelName, text, archiveTags, historyContext, travelContext);
            console.log(`[AI] ✅ ${modelName} succeeded`);
            return result;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`[AI] ❌ ${modelName} failed: ${message}`);
            lastError = err instanceof Error ? err : new Error(message);
        }
    }

    // 第二輪：Gemma models（14,400 RPD，prompt-based JSON）
    for (const modelName of GEMMA_MODELS) {
        try {
            console.log(`[AI] Trying Gemma: ${modelName}`);
            const result = await tryGemmaModel(modelName, text, archiveTags, historyContext, travelContext);
            console.log(`[AI] ✅ ${modelName} succeeded`);
            return result;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`[AI] ❌ ${modelName} failed: ${message}`);
            lastError = err instanceof Error ? err : new Error(message);
        }
    }

    console.error(`[AI] All models exhausted. Last error:`, lastError);
    return {
        type: "unknown",
        isError: true,
        errorMessage: lastError instanceof Error ? lastError.message : "All AI models failed",
    };
}
