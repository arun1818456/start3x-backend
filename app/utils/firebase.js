import "dotenv/config";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let isFirebaseInitialized = false;
let messagingInstance = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    }
    messagingInstance = getMessaging();
    isFirebaseInitialized = true;
    console.log("🔥 Firebase Admin Initialized successfully");
  } catch (err) {
    console.error("⚠️ Failed to initialize Firebase Admin:", err.message);
  }
} else {
  console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT is not defined in environment variables");
}

export { isFirebaseInitialized, messagingInstance };
export default messagingInstance;
