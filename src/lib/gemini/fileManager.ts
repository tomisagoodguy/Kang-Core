import { GoogleGenAI } from "@google/genai";

// We use the new `@google/genai` purely for file uploads, while using REST API for File Search Store operations
// to avoid any unstable or undocumented bindings in the new SDK version.
const API_KEY = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export class FileManager {
    private static storeCache = new Map<string, string>();

    /** Ensure a personal File Search Store exists for this user / group */
    public static async ensureStoreConfigured(userId: string): Promise<string> {
        if (this.storeCache.has(userId)) {
            return this.storeCache.get(userId)!;
        }

        const displayName = `user_${userId}`;

        try {
            // Check if store already exists
            const resList = await fetch(`https://generativelanguage.googleapis.com/v1beta/corpora?key=` + API_KEY);
            const dataList = await resList.json();

            let targetStore = (dataList.corpora || []).find((c: { displayName: string; name: string }) => c.displayName === displayName);

            if (!targetStore) {
                // If not exist, try to use corporas 
                // Note: The newer api uses corpora instead of fileSearchStores for some reason depending on endpoint
                // Google AI studio docs mention POST /v1beta/corpora
                const resCreate = await fetch(`https://generativelanguage.googleapis.com/v1beta/corpora?key=` + API_KEY, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ displayName })
                });
                targetStore = await resCreate.json();
            }

            if (targetStore?.name) {
                this.storeCache.set(userId, targetStore.name);
                return targetStore.name;
            }
        } catch (e) {
            console.error("[FileManager] ensureStoreConfigured REST error:", e);
        }

        throw new Error("Unable to get or create Gemini File Search Store.");
    }

    /** Upload a local file and wait for processing, then insert into File Search Store */
    public static async uploadToSearchStore(filePath: string, userId: string, originalName: string): Promise<boolean> {
        try {
            const storeName = await this.ensureStoreConfigured(userId);

            // 1. Upload generic file
            console.log(`[FileManager] Uploading generic file space: ${filePath}`);
            const uploadRes = await ai.files.upload({
                file: filePath,
                config: { displayName: originalName }
            });

            console.log(`[FileManager] Uploaded: ${uploadRes.name}, checking state...`);

            // 2. Poll until ACTIVE
            let state = uploadRes.state;
            let fileInfo = uploadRes;
            while (state === 'PROCESSING') {
                await new Promise(r => setTimeout(r, 2000));
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${uploadRes.name}?key=` + API_KEY);
                fileInfo = await res.json();
                state = fileInfo.state;
            }

            if (state !== 'ACTIVE') {
                console.error("[FileManager] File failed active state:", state);
                return false;
            }

            // 3. Link file directly to user Corpus Documents
            // Create a document using the uploaded file uri
            console.log(`[FileManager] Linking document to store: ${storeName}`);
            const docReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/${storeName}/documents?key=` + API_KEY, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    displayName: originalName
                })
            });
            const docResult = await docReq.json();

            if (docResult.name) {
                // Create a chunk utilizing the uploaded file data
                const chunkReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/${docResult.name}/chunks?key=` + API_KEY, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        data: {
                            fileUri: fileInfo.uri
                        }
                    })
                });
                console.log("[FileManager] Linked chunk status:", chunkReq.status);
            }

            return true;
        } catch (e) {
            console.error("[FileManager] Error uploading file:", e);
            return false;
        }
    }
}
