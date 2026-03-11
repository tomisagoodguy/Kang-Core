import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/firebase/admin";
import { safeExecute } from "@/lib/gemini/client";
import type { AccountingEntry } from "@/models/schema";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateFinancialInsights(userId: string): Promise<string> {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateStr = thirtyDaysAgo.toISOString().split("T")[0];

        // 1b. Check Persistent Cache (Firestore) - limit to 1 hour (3600s)
        const oneHourAgo = new Date(Date.now() - 3600000);
        const cachedSnapshot = await db.collection("insights")
            .where("createdAt", ">=", oneHourAgo)
            .orderBy("createdAt", "desc")
            .get();

        const userCache = cachedSnapshot.docs.find(doc => doc.data().userId === userId);

        if (userCache) {
            console.log(`[Insight] Using cached result from Firestore`);
            return userCache.data().content;
        }

        const snapshot = await db.collection("accounting")
            .where("date", ">=", dateStr)
            .orderBy("date", "desc")
            .get();

        const expenses = snapshot.docs.map(doc => doc.data());

        if (expenses.length === 0) {
            return "目前沒有足夠的消費資料進行分析。建議多記錄幾筆支出！";
        }

        // 2. Prepare data for Prompt
        const summary = expenses.reduce((acc: any, curr) => {
            const tag = curr.tag || 'Other';
            const amount = curr.amount || 0;
            acc.distribution[tag] = (acc.distribution[tag] || 0) + amount;
            if (tag === 'Income') {
                acc.income += amount;
                acc.netBalance += amount;
            } else {
                acc.expenses += amount;
                acc.netBalance -= amount;
            }
            return acc;
        }, { netBalance: 0, income: 0, expenses: 0, distribution: {} });

        const prompt = `
        你是一位專業的理財顧問。以下是使用者過去 30 天的財務摘要：
        總收入：$${summary.income}
        總支出：$${summary.expenses}
        淨結餘：$${summary.netBalance}
        
        類別分佈：${JSON.stringify(summary.distribution)}
        最近的幾筆交易：${JSON.stringify(expenses.slice(0, 10))}

        請提供 3 個簡短且具體理財建議或洞察（每點不超過 50 字）：
        1. 收支平衡分析
        2. 需要注意的潛在過度消費
        3. 一個具體的理財建議
        
        請直接輸出這 3 點，並使用繁體中文。
        `;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await safeExecute(() => model.generateContent(prompt));
        const responseText = result.response.text();

        // 3. Store insight in Firestore (optional cache)
        await db.collection("insights").add({
            userId,
            content: responseText,
            createdAt: new Date(),
            dataSnapshot: summary
        });

        return responseText;
    } catch (error) {
        console.error("Insight generation error:", error);
        return "暫時無法產生洞察分析，請稍後再試。";
    }
}
