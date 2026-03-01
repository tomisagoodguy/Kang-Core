import * as admin from "firebase-admin";

const MOCK_AI_MODE = process.env.MOCK_AI === "true";

if (!admin.apps.length) {
    try {
        // If we have an explicit private key (e.g., local dev or Vercel env variables)
        if (process.env.FIREBASE_PRIVATE_KEY) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    // Handle multiline string formatted private keys in env vars
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
                }),
            });
            console.log("Firebase Admin initialized with explicit credentials.");
        } else {
            // Fallback for GCP or default environments
            admin.initializeApp();
            console.log("Firebase Admin initialized with default credentials.");
        }
    } catch (error) {
        console.error("Firebase admin initialization error", error);
    }
}

const db = admin.firestore();

export { db, admin };
