export const handleDisconnect = async (io, socket) => {
    try {
        console.log(`🔌 Socket disconnected: ${socket.id} (${socket.userName || 'Unknown'} - Passkey: ${socket.passkey || 'none'})`);
    } catch (error) {
        console.error("handleDisconnect error:", error);
    }
};
