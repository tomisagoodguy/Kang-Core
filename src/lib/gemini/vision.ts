import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiParseResult } from "@/models/schema";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const TODAY = () => new Date().toISOString().split("T")[0];
const YESTERDAY = () => new Date(Date.now() - 86400000).toISOString().split("T")[0];

const VISION_PROMPT = () => `
You are an AI assistant for Kang-Core. Today is ${TODAY()}.
Analyze the image and respond ONLY with a valid JSON object. No markdown, no explanation.

Determine the image type and extract information:

1. If it's a RECEIPT, INVOICE, or BILL:
   - type = "accounting"
   - Extract: total amount paid, merchant type for tag, date on receipt
   - tag must be one of: Food, Transport, Entertainment, Utilities, Shopping, Health, Education, Other

2. If it's a SCREENSHOT, ARTICLE, NOTE, or other image with information:
   - type = "archive"
   - Summarize content, extract keywords

3. If unclear:
   - type = "unknown"

JSON format:
{
  "type": "accounting" | "archive" | "unknown",
  "explanation": "brief reason",
  "accountingData": {
    "amount": number,
    "tag": "Food" | "Transport" | "Entertainment" | "Utilities" | "Shopping" | "Health" | "Education" | "Other",
    "date": "YYYY-MM-DD",
    "description": "what was purchased"
  },
  "archiveData": {
    "url": null,
    "title": "image title or null",
    "summary": "content summary",
    "keywords": ["keyword1", "keyword2"]
  }
}

Only fill the relevant data object based on type. Output JSON only.
`.trim();

/**
 * 使用 Gemini Vision 分析圖片，回傳與 parseUserInput() 相同格式的結果
 */
export async function analyzeImage(
    imageBuffer: Buffer,
    mimeType: "image/jpeg" | "image/png" = "image/jpeg"
): Promise<GeminiParseResult> {
    // Vision 優先用 gemini-2.5-flash（支援 multimodal）
    const VISION_MODELS = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-3-flash-preview",
    ];

    let lastError: any = null;

    for (const modelName of VISION_MODELS) {
        try {
            console.log(`[Vision] Trying model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });

            const base64Image = imageBuffer.toString("base64");
            const result = await model.generateContent([
                VISION_PROMPT(),
                {
                    inlineData: {
                        mimeType,
                        data: base64Image,
                    },
                },
            ]);

            const raw = result.response.text().trim();

            // 提取 JSON（有些模型會包 markdown code block）
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON in Vision response");

            const parsed = JSON.parse(jsonMatch[0]) as GeminiParseResult;
            console.log(`[Vision] ✅ ${modelName} succeeded, type=${parsed.type}`);
            return { ...parsed, isError: false };

        } catch (err: any) {
            console.warn(`[Vision] ❌ ${modelName} failed: ${err?.message}`);
            lastError = err;
        }
    }

    return {
        type: "unknown",
        isError: true,
        errorMessage: lastError?.message ?? "Vision analysis failed",
    };
}
