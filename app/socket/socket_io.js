import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../modules/user/model.js";
import { handleJoinChat, handleSendMessage, handleDeleteMessage, handleDeleteMultipleMessages, handleTyping } from "./handlers/chatHandler.js";
import { handleDisconnect } from "./handlers/disconnect.js";

let ioInstance = null;

export const validateSocketSession = async (token) => {
    if (!token || typeof token !== "string" || !token.trim()) return { valid: true };
    try {
        const decoded = jwt.verify(token.trim(), process.env.JWT_SECRET);
        const userPayload = decoded.user || decoded;
        const userId = userPayload.id || userPayload._id;
        if (!userId) return { valid: false };

        const dbUser = await User.findById(userId).select("_id activeSessionId role name passkey");
        if (!dbUser) return { valid: false };

        if (dbUser.activeSessionId) {
            if (
                dbUser.activeSessionId === "LOGGED_OUT" ||
                !userPayload.sessionId ||
                userPayload.sessionId !== dbUser.activeSessionId
            ) {
                return { valid: false, userId: dbUser._id.toString() };
            }
        }
        return {
            valid: true,
            authenticated: true,
            userId: dbUser._id.toString(),
            role: dbUser.role || "user",
            name: dbUser.name || "",
            passkey: dbUser.passkey || "",
            sessionId: userPayload.sessionId || "",
        };
    } catch (_) {
        return { valid: true };
    }
};

export const initSocketIO = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PUT", "DELETE"],
        },
    });

    ioInstance = io;

    io.on("connection", (socket) => {
        console.log("⚡ New Socket Client Connected! Socket ID:", socket.id);

        // Join personal user room & verify single-device session
        socket.on("join_user", async (data) => {
            const { userId, token } = data || {};
            const check = await validateSocketSession(token);
            if (!check.valid) {
                socket.emit("session_expired", {
                    message: "Your account was logged in on another device. Please login again.",
                });
                return;
            }
            const uid = check.userId || userId;
            if (uid) {
                socket.userId = uid;
                socket.sessionId = check.sessionId || "";
                socket.join(`user_${uid}`);
                console.log(`👤 Socket ${socket.id} joined personal room: user_${uid}`);
            }
        });

        // Join chat room for a passkey
        socket.on("join_chat", (data) => {
            console.log(`📥 join_chat received from ${socket.id}:`, data);
            handleJoinChat(io, socket, data);
        });

        // Send chat message
        socket.on("send_message", (data) => {
            console.log(`📥 send_message received from ${socket.id}:`, data);
            handleSendMessage(io, socket, data);
        });

        // Delete chat message
        socket.on("delete_message", (data) => {
            console.log(`🗑️ delete_message received from ${socket.id}:`, data);
            handleDeleteMessage(io, socket, data);
        });

        // Delete multiple chat messages
        socket.on("delete_messages", (data) => {
            console.log(`🗑️ delete_messages received from ${socket.id}:`, data);
            handleDeleteMultipleMessages(io, socket, data);
        });

        // Typing indicator
        socket.on("typing", (data) => {
            handleTyping(io, socket, data);
        });

        // Disconnect
        socket.on("disconnect", () => {
            handleDisconnect(io, socket);
        });
    });

    console.log("📡 Socket.IO initialized and listening for connections");
    return io;
};

export const getIO = () => {
    return ioInstance;
};
