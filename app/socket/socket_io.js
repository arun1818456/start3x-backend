import { Server } from "socket.io";
import { handleJoinChat, handleSendMessage, handleTyping } from "./handlers/chatHandler.js";
import { handleDisconnect } from "./handlers/disconnect.js";

let ioInstance = null;

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
