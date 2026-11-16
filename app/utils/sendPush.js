import admin, { isFirebaseInitialized } from "./firebase.js";

export const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  if (!isFirebaseInitialized || !fcmToken) {
    console.log("ℹ️ Skipping push notification (Firebase not initialized or empty token)");
    return null;
  }

  // Ensure all data values are string format for FCM
  const sanitizedData = {};
  for (const [key, val] of Object.entries(data || {})) {
    sanitizedData[key] = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
  }

  const message = {
    token: fcmToken,
    notification: {
      title,
      body,
    },
    data: sanitizedData,
    android: {
      priority: "high",
      notification: {
        sound: "default",
        channelId: "alert_channel",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("🔥 Push notification sent successfully:", response);
    return response;
  } catch (err) {
    console.error("🔥 Push notification error:", err.message);
    return null;
  }
};

export const sendMultipleNotificationToUsers = async (
  tokens,
  title,
  body,
  data = {}
) => {
  if (!isFirebaseInitialized) {
    console.log("ℹ️ Skipping multicast push (Firebase not initialized)");
    return null;
  }

  const validTokens = (tokens || []).filter(
    (t) => t && typeof t === "string" && t.trim().length > 0
  );

  if (validTokens.length === 0) {
    console.log("ℹ️ No valid tokens found for multicast push");
    return null;
  }

  // Ensure all data values are strings
  const sanitizedData = {};
  for (const [key, val] of Object.entries(data || {})) {
    sanitizedData[key] = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
  }

  try {
    const message = {
      tokens: validTokens,
      notification: {
        title,
        body,
      },
      data: sanitizedData,
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "alert_channel",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`🔥 Multicast Push Sent: Success: ${response.successCount}, Failed: ${response.failureCount}`);
    return response;
  } catch (error) {
    console.error("🔥 Multicast push error:", error.message);
    return null;
  }
};
