import mongoose from "mongoose";
import Chat from "../../modules/chat/model.js";
import Lead from "../../modules/lead/model.js";
import User from "../../modules/user/model.js";
import { notifyPasskeyUsersAndAdmins } from "../../utils/sendPush.js";
import { validateSocketSession } from "../socket_io.js";

export const canDeleteMessage = (msg, requester) => {
    if (!msg || !requester || !requester.userId) return false;
    const msgSenderId = (msg.senderId || "").toString().trim();
    const reqUserId = requester.userId.toString().trim();
    const msgSenderName = (msg.senderName || "").toString().trim().toLowerCase();
    const reqRole = (requester.role || "").toString().trim().toLowerCase();
    const reqName = (requester.name || "").toString().trim().toLowerCase();

    // Admin can delete any message (own or any user's)
    if (reqRole === "admin") return true;

    if (msgSenderId) {
        return msgSenderId === reqUserId;
    }

    // Legacy messages created without senderId
    if (reqName && msgSenderName === reqName) return true;
    return false;
};

export const handleJoinChat = async (io, socket, data) => {
    try {
        const { passkey, userId, userName, role, token } = data || {};
        let resolvedUserId = userId;
        let resolvedRole = role || 'user';
        let resolvedName = userName;

        if (token) {
            const check = await validateSocketSession(token);
            if (!check.valid) {
                socket.emit("session_expired", {
                    message: "Your account was logged in on another device. Please login again.",
                });
                return;
            }
            if (check.sessionId) socket.sessionId = check.sessionId;
            if (check.authenticated) {
                resolvedUserId = check.userId;
                resolvedRole = check.role || resolvedRole;
                resolvedName = check.name || resolvedName;
            }
        }

        const room = passkey || 'default';
        socket.join(room);
        if (resolvedUserId) {
            socket.join(`user_${resolvedUserId}`);
        }
        socket.passkey = room;
        socket.userId = resolvedUserId;
        socket.userName = resolvedName || userName;
        socket.role = resolvedRole;
        console.log(`💬 Socket ${socket.id} (${userName || 'User'} [Role: ${socket.role}]) joined chat room: ${room}`);
        socket.emit("joined_chat", { success: true, room });
    } catch (error) {
        console.error("handleJoinChat error:", error);
    }
};

export const handleSendMessage = async (io, socket, data) => {
    try {
        console.log("💬 Socket send_message received:", data);
        let { passkey, senderId, senderName, messageText, messageType, leadId, leadRank, leadIds, role, token } = data || {};
        if (token) {
            const check = await validateSocketSession(token);
            if (!check.valid) {
                socket.emit("session_expired", {
                    message: "Your account was logged in on another device. Please login again.",
                });
                return;
            }
        }

        if ((!messageText || messageText.trim() === '') && !leadId && !leadRank && (!leadIds || leadIds.length === 0)) {
            socket.emit("chat_error", { message: "Message text or lead is required" });
            return;
        }

        passkey = passkey || socket.passkey || 'default';
        senderId = senderId || socket.userId || '';

        // ✅ If sender is Admin, ensure senderName is saved as "Admin"
        if (role === 'admin' || socket.role === 'admin' || (senderName && senderName.trim().toLowerCase() === 'admin')) {
            senderName = 'Admin';
        } else {
            senderName = senderName || socket.userName || 'User';
        }

        let flaggedLeadDocs = [];
        if (Array.isArray(leadIds) && leadIds.length > 0) {
            try {
                flaggedLeadDocs = await Lead.find({ _id: { $in: leadIds } });
            } catch (e) {
                console.error("Error looking up leads by IDs:", e);
            }
        }

        if (flaggedLeadDocs.length === 0 && leadId) {
            try {
                const singleLead = await Lead.findById(leadId);
                if (singleLead) flaggedLeadDocs.push(singleLead);
            } catch (e) {
                console.error("Error looking up lead by ID:", e);
            }
        }

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

        const newChatMessage = await Chat.create({
            passkey,
            senderId,
            senderName,
            messageType: type,
            messageText: messageText || (flaggedLeadDocs.length > 0 ? `${flaggedLeadDocs.length} Lead(s) Flagged` : ''),
            flaggedLeads: flaggedLeadDocs.map(l => l._id),
        });

        const populatedMessage = await Chat.findById(newChatMessage._id)
            .populate({
                path: 'flaggedLeads',
                strictPopulate: false,
            });

        // Broadcast to everyone in the passkey room (including sender)
        io.to(passkey).emit("receive_message", populatedMessage);
        console.log(`💬 Message broadcasted from [${senderName}] to room [${passkey}]:`, populatedMessage._id);

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
            console.error("Push notification error in handleSendMessage:", pushErr.message);
        }
    } catch (error) {
        console.error("handleSendMessage error:", error);
        socket.emit("chat_error", { message: error.message });
    }
};

export const handleDeleteMessage = async (io, socket, data) => {
    try {
        const { messageId, passkey, token } = data || {};
        if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
            socket.emit("chat_error", { message: "Invalid message ID" });
            return;
        }

        let requester = null;
        if (token) {
            const check = await validateSocketSession(token);
            if (!check.valid) {
                socket.emit("session_expired", {
                    message: "Your account was logged in on another device. Please login again.",
                });
                return;
            }
            if (check.authenticated) {
                requester = {
                    userId: check.userId,
                    role: check.role,
                    name: check.name,
                };
            }
        }

        if (!requester && socket.userId && mongoose.Types.ObjectId.isValid(socket.userId)) {
            const dbUser = await User.findById(socket.userId).select("_id role name");
            if (dbUser) {
                requester = {
                    userId: dbUser._id.toString(),
                    role: dbUser.role || "user",
                    name: dbUser.name || "",
                };
            }
        }

        if (!requester) {
            socket.emit("chat_error", { message: "Please authenticate to delete messages" });
            return;
        }

        const msg = await Chat.findById(messageId);
        if (!msg) {
            socket.emit("chat_error", { message: "Chat message not found" });
            return;
        }

        if (!canDeleteMessage(msg, requester)) {
            socket.emit("chat_error", { message: "You can only delete your own messages" });
            return;
        }

        const deleted = await Chat.findByIdAndDelete(messageId);
        if (!deleted) {
            socket.emit("chat_error", { message: "Chat message not found" });
            return;
        }

        const room = deleted.passkey || passkey || socket.passkey || "default";
        io.to(room).emit("message_deleted", {
            messageId: deleted._id.toString(),
            passkey: room,
        });
        console.log(`🗑️ Message [${deleted._id}] deleted by [${requester.userId}] in room [${room}]`);
    } catch (error) {
        console.error("handleDeleteMessage error:", error);
        socket.emit("chat_error", { message: error.message });
    }
};

export const handleDeleteMultipleMessages = async (io, socket, data) => {
    try {
        const { messageIds, passkey, token } = data || {};
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            socket.emit("chat_error", { message: "Message IDs are required" });
            return;
        }

        const validIds = [...new Set(
            messageIds
                .map((id) => (id || "").toString().trim())
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
        )];

        if (validIds.length === 0) {
            socket.emit("chat_error", { message: "Invalid message IDs" });
            return;
        }

        let requester = null;
        if (token) {
            const check = await validateSocketSession(token);
            if (!check.valid) {
                socket.emit("session_expired", {
                    message: "Your account was logged in on another device. Please login again.",
                });
                return;
            }
            if (check.authenticated) {
                requester = {
                    userId: check.userId,
                    role: check.role,
                    name: check.name,
                };
            }
        }

        if (!requester && socket.userId && mongoose.Types.ObjectId.isValid(socket.userId)) {
            const dbUser = await User.findById(socket.userId).select("_id role name");
            if (dbUser) {
                requester = {
                    userId: dbUser._id.toString(),
                    role: dbUser.role || "user",
                    name: dbUser.name || "",
                };
            }
        }

        if (!requester) {
            socket.emit("chat_error", { message: "Please authenticate to delete messages" });
            return;
        }

        const docs = await Chat.find({ _id: { $in: validIds } });
        if (!docs || docs.length === 0) {
            socket.emit("chat_error", { message: "Messages not found" });
            return;
        }

        const deletableDocs = docs.filter((msg) => canDeleteMessage(msg, requester));
        if (deletableDocs.length === 0) {
            socket.emit("chat_error", { message: "You can only delete your own messages" });
            return;
        }

        const deletableIds = deletableDocs.map((d) => d._id);
        await Chat.deleteMany({ _id: { $in: deletableIds } });

        // Group deleted message IDs by passkey room
        const byRoom = {};
        for (const d of deletableDocs) {
            const r = d.passkey || passkey || socket.passkey || "default";
            if (!byRoom[r]) byRoom[r] = [];
            byRoom[r].push(d._id.toString());
        }

        for (const [room, ids] of Object.entries(byRoom)) {
            io.to(room).emit("messages_deleted", {
                messageIds: ids,
                passkey: room,
            });
            console.log(`🗑️ ${ids.length} messages deleted by [${requester.userId}] in room [${room}]`);
        }
    } catch (error) {
        console.error("handleDeleteMultipleMessages error:", error);
        socket.emit("chat_error", { message: error.message });
    }
};

export const handleTyping = (io, socket, data) => {
    const { passkey, userName, isTyping } = data || {};
    const room = passkey || socket.passkey || 'default';
    socket.to(room).emit("user_typing", {
        userName: userName || socket.userName || 'Someone',
        isTyping: !!isTyping,
    });
};
