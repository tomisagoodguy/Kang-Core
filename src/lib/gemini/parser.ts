import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import { GeminiParseResult } from "@/models/schema";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const MOCK_AI = process.env.MOCK_AI === "true";

// Ensure structured output via schema definition
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

export async function parseUserInput(text: string): Promise<GeminiParseResult> {
    if (MOCK_AI) {
        console.log(`[MOCK MODE] Parsing input instead of calling Gemini: "${text}"`);
        // Mock logic: Very simple regex.
        const isMoney = /\d/.test(text) && (text.includes("買") || text.includes("吃") || text.includes("花"));
        if (isMoney) {
            return {
                type: "accounting",
                isError: false,
                accountingData: {
                    amount: parseInt(text.match(/\d+/)![0], 10),
                    tag: "Other", // Simplified for mock
                    date: new Date().toISOString().split("T")[0],
                    description: text,
                },
                explanation: "Mock mode deemed this accounting.",
            };
        } else {
            return {
                type: "archive",
                isError: false,
                archiveData: {
                    url: text.startsWith("http") ? text : undefined,
                    summary: `Archived: ${text}`,
                    keywords: ["mock", "archive"],
                },
                explanation: "Mock mode deemed this an archive.",
            };
        }
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: `You are an AI assistant that parses user intent for the Kang-Core system. You decide if a user is trying to log an expense (accounting) or save information/note/link (archive). Today is ${new Date().toISOString().split("T")[0]}.`,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: outputSchema,
            },
        });

        const result = await model.generateContent(text);
        const parsed = JSON.parse(result.response.text()) as GeminiParseResult;
        return { ...parsed, isError: false };
    } catch (error) {
        console.error("Gemini Parsing Error:", error);
        return {
            type: "unknown",
            isError: true,
            errorMessage: error instanceof Error ? error.message : "Failure during text processing",
        };
    }
}
