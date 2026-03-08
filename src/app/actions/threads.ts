"use server";

import { db } from "@/lib/firebase/admin";
import { revalidatePath } from "next/cache";

export async function deleteThreadAction(id: string) {
    try {
        await db.collection("threads").doc(id).delete();
        revalidatePath("/threads");
        revalidatePath("/");
        return { success: true };
    } catch (e) {
        console.error("Failed to delete thread:", e);
        return { success: false, error: e instanceof Error ? e.message : "Failed to delete" };
    }
}

export async function toggleThreadSaveAction(id: string, isSaved: boolean) {
    try {
        await db.collection("threads").doc(id).update({ isSaved });
        revalidatePath("/threads");
        revalidatePath("/");
        return { success: true };
    } catch (e) {
        console.error("Failed to save thread:", e);
        return { success: false, error: e instanceof Error ? e.message : "Failed to save thread" };
    }
}
