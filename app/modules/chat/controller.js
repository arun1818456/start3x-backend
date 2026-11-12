import Chat from "./model.js";
import Lead from "../lead/model.js";
import "../response/model.js";
import { sendResponse } from "../../utils/sendResposeType.js";
import { getIO } from "../../socket/socket_io.js";

// ✅ CREATE / SEND CHAT MESSAGE (WITH OPTIONAL FLAGGED LEAD)
export const sendChatMessage = async (req, res) => {
    try {
        console.log("📥 Send Chat Message Request:", req.body);
        let { passkey, senderName, messageText, messageType, leadId, leadRank } = req.body || {};

        if (!messageText || messageText.trim() === '') {
            return sendResponse(res, 400, false, "Message text is required");
        }

        passkey = passkey || req.user?.passkey || 'default';

        // Enforce Admin name if user is admin or role is admin
        const isAdmin = req.user?.role === 'admin' || (senderName && senderName.trim().toLowerCase() === 'admin');
        if (isAdmin) {
            senderName = 'Admin';
        } else {
            senderName = senderName || req.user?.name || 'User';
        }

        let flaggedLeadDoc = null;

        // If leadId is provided directly
        if (leadId) {
            try {
                flaggedLeadDoc = await Lead.findById(leadId);
            } catch (e) {
                console.error("Error looking up lead by ID:", e);
            }
        }

        // If leadRank or lead number (e.g. "#1" or "1") is provided
        if (!flaggedLeadDoc && leadRank) {
            try {
                const formattedRank = leadRank.startsWith('#') ? leadRank : `#${leadRank}`;
                flaggedLeadDoc = await Lead.findOne({ passkey, rank: formattedRank });
                if (!flaggedLeadDoc) {
                    flaggedLeadDoc = await Lead.findOne({ rank: formattedRank });
                }
            } catch (e) {
                console.error("Error looking up lead by rank:", e);
            }
        }

        const type = flaggedLeadDoc ? 'flagged_lead' : (messageType || 'text');
        const senderId = req.user?._id || req.user?.id || req.body?.senderId || '';

        const newChatMessage = await Chat.create({
            passkey,
            senderId,
            senderName,
            messageText,
            messageType: type,
            flaggedLead: flaggedLeadDoc ? flaggedLeadDoc._id : null,
        });

        // Populate flaggedLead before returning
        const populatedMessage = await Chat.findById(newChatMessage._id).populate({
            path: 'flaggedLead',
            populate: { path: 'responses', options: { sort: { createdAt: -1 } } },
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
                path: 'flaggedLead',
                populate: { path: 'responses', options: { sort: { createdAt: -1 } } },
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
