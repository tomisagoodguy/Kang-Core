import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import { GeminiParseResult } from "@/models/schema";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const MOCK_AI = process.env.MOCK_AI === "true";

// ─── Schema for Gemini models (support responseSchema) ───────────────────────
const outputSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        type: {
            type: SchemaType.STRING,
            description: "Must be one of: 'accounting', 'archive', 'unknown'",
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
  "type": "accounting" | "archive" | "unknown",
  "explanation": "string (brief reason)",
  "accountingData": {
    "amount": number,
    "tag": "Food" | "Transport" | "Entertainment" | "Utilities" | "Shopping" | "Health" | "Education" | "Other",
    "date": "YYYY-MM-DD",
    "description": "string"
  },
  "archiveData": {
    "url": "string or null",
    "title": "string or null",
    "summary": "string",
    "keywords": ["string"]
  }
}

Rules:
- If user mentions spending money, food, transport, shopping → type = "accounting", fill accountingData
- If user shares a link, article, note, or knowledge → type = "archive", fill archiveData
- Otherwise → type = "unknown"
- For "yesterday" use ${new Date(Date.now() - 86400000).toISOString().split("T")[0]}
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
    const result = await model.generateContent(text);
    const parsed = JSON.parse(result.response.text()) as GeminiParseResult;
    return { ...parsed, isError: false };
}

async function tryGemmaModel(modelName: string, text: string): Promise<GeminiParseResult> {
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `${SYSTEM_PROMPT()}\n\nUser input: "${text}"`;
    const result = await model.generateContent(prompt);
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
