import { db } from "@/lib/firebase/admin";
import { getEmbedding } from "@/lib/gemini/embedding";

export interface RAGDocument {
    id: string;
    title?: string;
    summary?: string;
    keywords?: string[];
    url?: string;
    originalText?: string;
    score: number;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class RAGService {
    /**
     * 從 Archive 搜尋語意最相關的筆記
     */
    static async search(queryText: string, topK: number = 3): Promise<RAGDocument[]> {
        const queryEmbedding = await getEmbedding(queryText).catch(() => null);
        if (!queryEmbedding) {
            console.error("[RAGService] Failed to generate query embedding.");
            return [];
        }

        const snapshot = await db.collection("archive").get();
        const results: RAGDocument[] = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();
            if (data.embedding && Array.isArray(data.embedding)) {
                const similarity = cosineSimilarity(queryEmbedding, data.embedding);
                results.push({
                    id: doc.id,
                    title: data.title,
                    summary: data.summary,
                    keywords: data.keywords,
                    url: data.url || data.imageUrl,
                    originalText: data.originalText,
                    score: similarity,
                });
            }
        }

        // 以相似度由高到低排序，回傳前 topK 個
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }
}
