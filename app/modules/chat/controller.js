import mongoose from "mongoose";
import Chat from "./model.js";
import Lead from "../lead/model.js";
import "../response/model.js";
import { sendResponse } from "../../utils/sendResposeType.js";
import { getIO } from "../../socket/socket_io.js";
import { canDeleteMessage } from "../../socket/handlers/chatHandler.js";
import { notifyPasskeyUsersAndAdmins } from "../../utils/sendPush.js";

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

        // 🔥 Send push notification to all other users with this passkey AND admins
        try {
            const preview = messageText || (flaggedLeadDocs.length > 0 ? `Shared ${flaggedLeadDocs.length} lead(s)` : 'New message');
            notifyPasskeyUsersAndAdmins({
                passkey,
                includePasskeyUsers: true,
                includeAdmins: true,
                excludeUserId: senderId,
                title: `💬 ${senderName}`,
                body: preview,
                type: "chat_message",
                data: {
                    type: "chat_message",
                    passkey,
                    messageType: type,
                    ...(flaggedLeadDocs.length > 0 ? { leadId: flaggedLeadDocs[0]._id.toString() } : {}),
                },
            });
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

// ✅ DELETE CHAT MESSAGE (ONLY OWNER CAN DELETE)
export const deleteChatMessage = async (req, res) => {
    try {
        if (!req.user) {
            return sendResponse(res, 401, false, "Please authenticate");
        }

        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return sendResponse(res, 400, false, "Invalid chat message ID");
        }

        const msg = await Chat.findById(id);
        if (!msg) {
            return sendResponse(res, 404, false, "Chat message not found");
        }

        const requester = {
            userId: (req.user._id || req.user.id || "").toString(),
            role: req.user.role || "user",
            name: req.user.name || "",
        };

        if (!canDeleteMessage(msg, requester)) {
            return sendResponse(res, 403, false, "You can only delete your own messages");
        }

        const deleted = await Chat.findByIdAndDelete(id);
        if (!deleted) {
            return sendResponse(res, 404, false, "Chat message not found");
        }

        // Broadcast deletion to everyone in the passkey room in real-time
        try {
            const io = getIO();
            if (io) {
                const room = deleted.passkey || "default";
                io.to(room).emit("message_deleted", {
                    messageId: deleted._id.toString(),
                    passkey: room,
                });
                console.log(`🗑️ HTTP chat message [${deleted._id}] deleted & emitted to room [${room}]`);
            }
        } catch (socketErr) {
            console.error("Socket emit error in deleteChatMessage:", socketErr);
        }

        return sendResponse(res, 200, true, "Chat message deleted successfully", deleted);
    } catch (error) {
        console.error("Delete Chat Message Error:", error);
        return sendResponse(res, 500, false, "Error deleting chat message", null, error.message);
    }
};

// ✅ DELETE MULTIPLE CHAT MESSAGES (OWNER OR ADMIN)
export const deleteMultipleChatMessages = async (req, res) => {
    try {
        if (!req.user) {
            return sendResponse(res, 401, false, "Please authenticate");
        }

        const { messageIds } = req.body || {};
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            return sendResponse(res, 400, false, "Message IDs are required");
        }

        const validIds = [...new Set(
            messageIds
                .map((id) => (id || "").toString().trim())
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
        )];

        if (validIds.length === 0) {
            return sendResponse(res, 400, false, "Invalid chat message IDs");
        }

        const docs = await Chat.find({ _id: { $in: validIds } });
        if (!docs || docs.length === 0) {
            return sendResponse(res, 404, false, "Chat messages not found");
        }

        const requester = {
            userId: (req.user._id || req.user.id || "").toString(),
            role: req.user.role || "user",
            name: req.user.name || "",
        };

        const deletableDocs = docs.filter((msg) => canDeleteMessage(msg, requester));
        if (deletableDocs.length === 0) {
            return sendResponse(res, 403, false, "You can only delete your own messages");
        }

        const deletableIds = deletableDocs.map((d) => d._id);
        await Chat.deleteMany({ _id: { $in: deletableIds } });

        // Broadcast deletion to each affected passkey room in real-time
        try {
            const io = getIO();
            if (io) {
                const byRoom = {};
                for (const d of deletableDocs) {
                    const room = d.passkey || "default";
                    if (!byRoom[room]) byRoom[room] = [];
                    byRoom[room].push(d._id.toString());
                }
                for (const [room, ids] of Object.entries(byRoom)) {
                    io.to(room).emit("messages_deleted", {
                        messageIds: ids,
                        passkey: room,
                    });
                    console.log(`🗑️ HTTP batch deleted ${ids.length} messages & emitted to room [${room}]`);
                }
            }
        } catch (socketErr) {
            console.error("Socket emit error in deleteMultipleChatMessages:", socketErr);
        }

        return sendResponse(res, 200, true, "Messages deleted successfully", {
            deletedIds: deletableDocs.map((d) => d._id.toString()),
            deletedCount: deletableDocs.length,
        });
    } catch (error) {
        console.error("Delete Multiple Chat Messages Error:", error);
        return sendResponse(res, 500, false, "Error deleting chat messages", null, error.message);
    }
};
