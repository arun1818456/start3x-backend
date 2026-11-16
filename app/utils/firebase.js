import admin from "firebase-admin";

let isFirebaseInitialized = false;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    isFirebaseInitialized = true;
    console.log("🔥 Firebase Admin Initialized successfully");
  } catch (err) {
    console.error("⚠️ Failed to initialize Firebase Admin:", err.message);
  }
} else {
  console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT is not defined in environment variables");
}

export { isFirebaseInitialized };
export default admin;
