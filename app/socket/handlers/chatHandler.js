import Chat from "../../modules/chat/model.js";
import Lead from "../../modules/lead/model.js";

export const handleJoinChat = async (io, socket, data) => {
    try {
        const { passkey, userId, userName, role } = data || {};
        const room = passkey || 'default';
        socket.join(room);
        socket.passkey = room;
        socket.userId = userId;
        socket.userName = userName;
        socket.role = role || 'user';
        console.log(`💬 Socket ${socket.id} (${userName || 'User'} [Role: ${socket.role}]) joined chat room: ${room}`);
        socket.emit("joined_chat", { success: true, room });
    } catch (error) {
        console.error("handleJoinChat error:", error);
    }
};

export const handleSendMessage = async (io, socket, data) => {
    try {
        console.log("💬 Socket send_message received:", data);
        let { passkey, senderId, senderName, messageText, messageType, leadId, leadRank, role } = data || {};

        if (!messageText || messageText.trim() === '') {
            socket.emit("chat_error", { message: "Message text is required" });
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

        let flaggedLeadDoc = null;
        if (leadId) {
            try {
                flaggedLeadDoc = await Lead.findById(leadId);
            } catch (e) {
                console.error("Error looking up lead by ID:", e);
            }
        }

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

        const newChatMessage = await Chat.create({
            passkey,
            senderId,
            senderName,
            messageType: type,
            messageText,
            flaggedLead: flaggedLeadDoc ? flaggedLeadDoc._id : null,
        });

        const populatedMessage = await Chat.findById(newChatMessage._id).populate({
            path: 'flaggedLead',
            strictPopulate: false,
        });

        // Broadcast to everyone in the passkey room (including sender)
        io.to(passkey).emit("receive_message", populatedMessage);
        console.log(`💬 Message broadcasted from [${senderName}] to room [${passkey}]:`, populatedMessage._id);
    } catch (error) {
        console.error("handleSendMessage error:", error);
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
