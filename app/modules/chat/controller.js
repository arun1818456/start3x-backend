import Chat from "./model.js";
import Lead from "../lead/model.js";
import User from "../user/model.js";
import "../response/model.js";
import { sendResponse } from "../../utils/sendResposeType.js";
import { getIO } from "../../socket/socket_io.js";
import { sendMultipleNotificationToUsers } from "../../utils/sendPush.js";

// ✅ CREATE / SEND CHAT MESSAGE (WITH OPTIONAL FLAGGED LEAD)
export const sendChatMessage = async (req, res) => {
    try {
        console.log("📥 Send Chat Message Request:", req.body);
        let { passkey, senderName, messageText, messageType, leadId, leadRank, leadIds } = req.body || {};

        if ((!messageText || messageText.trim() === '') && !leadId && !leadRank && (!leadIds || leadIds.length === 0)) {
            return sendResponse(res, 400, false, "Message text or lead is required");
        }

        passkey = passkey || req.user?.passkey || 'default';

        // Enforce Admin name if user is admin or role is admin
        const isAdmin = req.user?.role === 'admin' || (senderName && senderName.trim().toLowerCase() === 'admin');
        if (isAdmin) {
            senderName = 'Admin';
        } else {
            senderName = senderName || req.user?.name || 'User';
        }

        let flaggedLeadDocs = [];

        // 1. If leadIds array is provided
        if (Array.isArray(leadIds) && leadIds.length > 0) {
            try {
                flaggedLeadDocs = await Lead.find({ _id: { $in: leadIds } });
            } catch (e) {
                console.error("Error looking up leads by IDs:", e);
            }
        }

        // 2. If single leadId is provided directly
        if (flaggedLeadDocs.length === 0 && leadId) {
            try {
                const singleLead = await Lead.findById(leadId);
                if (singleLead) flaggedLeadDocs.push(singleLead);
            } catch (e) {
                console.error("Error looking up lead by ID:", e);
            }
        }

        // 3. If leadRank or lead number (e.g. "#1" or "1") is provided
        if (flaggedLeadDocs.length === 0 && leadRank) {
            try {
                const formattedRank = leadRank.startsWith('#') ? leadRank : `#${leadRank}`;
                let singleLead = await Lead.findOne({ passkey, rank: formattedRank });
                if (!singleLead) {
                    singleLead = await Lead.findOne({ rank: formattedRank });
                }
                if (singleLead) flaggedLeadDocs.push(singleLead);
            } catch (e) {
                console.error("Error looking up lead by rank:", e);
            }
        }

        const type = flaggedLeadDocs.length > 0 ? 'flagged_lead' : (messageType || 'text');
        const senderId = req.user?._id || req.user?.id || req.body?.senderId || '';

        const newChatMessage = await Chat.create({
            passkey,
            senderId,
            senderName,
            messageText: messageText || (flaggedLeadDocs.length > 0 ? `${flaggedLeadDocs.length} Lead(s) Flagged` : ''),
            messageType: type,
            flaggedLeads: flaggedLeadDocs.map(l => l._id),
        });

        // Populate flaggedLeads before returning
        const populatedMessage = await Chat.findById(newChatMessage._id)
            .populate({
                path: 'flaggedLeads',
                strictPopulate: false,
            });

        // Broadcast to socket room in real-time
        try {
            const io = getIO();
            if (io) {
                io.to(passkey).emit("receive_message", populatedMessage);
                console.log(`💬 HTTP chat message emitted via Socket to room [${passkey}]`);
            }
        } catch (socketErr) {
            console.error("Socket emit error in sendChatMessage:", socketErr);
        }

        // 🔥 Send push notification to all other users with this passkey
        try {
            const users = await User.find({
                passkey,
                deviceToken: { $exists: true, $ne: "" },
            });
            const senderUserId = (senderId || req.user?._id || req.user?.id || '').toString();
            const tokens = users
                .filter(u => u._id.toString() !== senderUserId)
                .map(u => u.deviceToken)
                .filter(Boolean);

            if (tokens.length > 0) {
                const preview = messageText || (flaggedLeadDocs.length > 0 ? `Shared ${flaggedLeadDocs.length} lead(s)` : 'New message');
                sendMultipleNotificationToUsers(
                    tokens,
                    `💬 ${senderName}`,
                    preview,
                    {
                        type: "chat_message",
                        passkey,
                    }
                );
            }
        } catch (pushErr) {
            console.error("Push notification error in sendChatMessage:", pushErr.message);
        }

        return sendResponse(res, 200, true, "Message posted successfully", populatedMessage);
    } catch (error) {
        console.error("Send Chat Message Error:", error);
        return sendResponse(res, 500, false, "Error sending chat message", null, error.message);
    }
};

// ✅ GET ALL CHAT MESSAGES
export const getChatMessages = async (req, res) => {
    try {
        const { passkey } = req.query;
        const filter = {};
        if (passkey) {
            filter.passkey = passkey;
        }

        const messages = await Chat.find(filter)
            .populate({
                path: 'flaggedLeads',
                strictPopulate: false,
            })
            .sort({ createdAt: 1 });

        return sendResponse(res, 200, true, "Chat messages fetched successfully", messages);
    } catch (error) {
        console.error("Get Chat Messages Error:", error);
        return sendResponse(res, 500, false, "Error fetching chat messages", null, error.message);
    }
};

// ✅ DELETE CHAT MESSAGE
export const deleteChatMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Chat.findByIdAndDelete(id);
        if (!deleted) {
            return sendResponse(res, 404, false, "Chat message not found");
        }
        return sendResponse(res, 200, true, "Chat message deleted successfully", deleted);
    } catch (error) {
        console.error("Delete Chat Message Error:", error);
        return sendResponse(res, 500, false, "Error deleting chat message", null, error.message);
    }
};
