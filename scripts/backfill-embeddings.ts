import { db } from "../src/lib/firebase/admin";
import { getEmbedding } from "../src/lib/gemini/embedding";

async function backfillEmbeddings() {
    console.log("Starting backfill for archive embeddings...");

    try {
        const snapshot = await db.collection("archive").get();
        if (snapshot.empty) {
            console.log("No archive entries found.");
            return;
        }

        let successCount = 0;
        let failCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // Skip if already has embedding
            if (data.embedding) {
                console.log(`[SKIP] Doc ${doc.id} already has an embedding.`);
                continue;
            }

            let embeddingText = "";
            if (data.source === "line-file") {
                embeddingText = `檔案: ${data.title} 此檔案由 LINE 機器人上傳，尚未提供詳細解析。`;
            } else if (data.summary && data.keywords) {
                embeddingText = `${data.summary} ${data.keywords.join(", ")}`;
            } else {
                embeddingText = data.originalText || data.title || "";
            }

            if (!embeddingText.trim()) {
                console.log(`[SKIP] Doc ${doc.id} has no valid text to embed.`);
                continue;
            }

            console.log(`[PROCESS] Generating embedding for doc ${doc.id}...`);
            try {
                const embeddingArray = await getEmbedding(embeddingText);
                await db.collection("archive").doc(doc.id).update({
                    embedding: embeddingArray
                });
                successCount++;
                console.log(`[SUCCESS] Doc ${doc.id}`);
            } catch (err) {
                console.error(`[FAIL] Doc ${doc.id}`, err);
                failCount++;
            }
        }

        console.log(`Backfill finished. Success: ${successCount}, Fail: ${failCount}`);
    } catch (error) {
        console.error("Error during backfill:", error);
    }
}

backfillEmbeddings().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
