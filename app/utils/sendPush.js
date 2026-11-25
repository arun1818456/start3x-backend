import messagingInstance, { isFirebaseInitialized } from "./firebase.js";
import User from "../modules/user/model.js";
import Notification from "../modules/notifications/model.js";

const sanitizePayloadData = (data = {}) => {
  const sanitizedData = {};
  for (const [key, val] of Object.entries(data || {})) {
    sanitizedData[key] = typeof val === "object" ? JSON.stringify(val) : String(val ?? "");
  }
  return sanitizedData;
};

const cleanupInvalidTokens = async (tokens, responses) => {
  try {
    const invalidTokens = [];
    responses.forEach((res, idx) => {
      if (!res.success && res.error) {
        const code = res.error.code || "";
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });
    if (invalidTokens.length > 0) {
      await User.updateMany(
        { deviceToken: { $in: invalidTokens } },
        { $set: { deviceToken: "" } }
      );
      console.log(`🧹 Cleared ${invalidTokens.length} invalid/expired FCM token(s)`);
    }
  } catch (err) {
    console.error("Cleanup invalid tokens error:", err.message);
  }
};

export const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  if (!isFirebaseInitialized || !fcmToken) {
    console.log("ℹ️ Skipping push notification (Firebase not initialized or empty token)");
    return null;
  }

  const sanitizedData = sanitizePayloadData(data);

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
        icon: "ic_notification",
        color: "#007AFF",
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
    const response = await messagingInstance.send(message);
    console.log("🔥 Push notification sent successfully:", response);
    return response;
  } catch (err) {
    console.error("🔥 Push notification error:", err.message);
    if (
      err.code === "messaging/registration-token-not-registered" ||
      err.code === "messaging/invalid-registration-token"
    ) {
      await User.updateMany({ deviceToken: fcmToken }, { $set: { deviceToken: "" } });
    }
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

  const validTokens = Array.from(
    new Set(
      (tokens || []).filter(
        (t) => t && typeof t === "string" && t.trim().length > 0
      )
    )
  );

  if (validTokens.length === 0) {
    console.log("ℹ️ No valid tokens found for multicast push");
    return null;
  }

  const sanitizedData = sanitizePayloadData(data);

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
          icon: "ic_notification",
          color: "#007AFF",
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

    const response = await messagingInstance.sendEachForMulticast(message);
    console.log(`🔥 Multicast Push Sent: Success: ${response.successCount}, Failed: ${response.failureCount}`);
    if (response.failureCount > 0 && Array.isArray(response.responses)) {
      await cleanupInvalidTokens(validTokens, response.responses);
    }
    return response;
  } catch (error) {
    console.error("🔥 Multicast push error:", error.message);
    return null;
  }
};

/**
 * High-level helper:
 * 1. Finds target users (matching passkey and/or admins), excluding actor (`excludeUserId`)
 * 2. Saves Notification history documents in MongoDB (`notifications` collection)
 * 3. Dispatches FCM push notifications to all valid deviceTokens
 */
export const notifyPasskeyUsersAndAdmins = async ({
  passkey = "",
  includePasskeyUsers = true,
  includeAdmins = true,
  excludeUserId = "",
  title,
  body,
  type = "INFO",
  data = {},
}) => {
  try {
    const orConditions = [];
    if (includePasskeyUsers && passkey) {
      orConditions.push({ passkey });
    }
    if (includeAdmins) {
      orConditions.push({ role: "admin" });
    }

    if (orConditions.length === 0) return null;

    const users = await User.find({ $or: orConditions }).select("_id deviceToken role passkey");
    const excludedIdStr = excludeUserId ? excludeUserId.toString() : "";

    const targetUsers = users.filter((u) => u._id.toString() !== excludedIdStr);
    if (targetUsers.length === 0) return null;

    // Save DB notification history
    const leadIdVal = data?.leadId ? String(data.leadId) : "";
    const docs = targetUsers.map((u) => ({
      userId: u._id,
      title,
      message: body,
      type: String(type || "INFO").toUpperCase(),
      passkey: passkey || u.passkey || "",
      leadId: leadIdVal,
    }));
    await Notification.insertMany(docs);

    // Send FCM push to users with valid deviceToken
    const tokens = targetUsers
      .map((u) => u.deviceToken)
      .filter((t) => t && typeof t === "string" && t.trim().length > 0);

    if (tokens.length > 0) {
      return await sendMultipleNotificationToUsers(tokens, title, body, {
        ...data,
        type: data.type || type,
        ...(passkey ? { passkey } : {}),
      });
    }
    return null;
  } catch (err) {
    console.error("notifyPasskeyUsersAndAdmins error:", err.message);
    return null;
  }
};
