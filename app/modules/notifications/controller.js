import mongoose from "mongoose";
import Notification from "./model.js";

const resolveTargetUserId = (req) => {
    const loggedInUserId = req.user.id || req.user._id;
    const isAdmin = req.user.role === "admin";
    const requestedUserId =
        isAdmin && req.query?.userId ? String(req.query.userId).trim() : "";

    if (requestedUserId) {
        if (!mongoose.Types.ObjectId.isValid(requestedUserId)) {
            return { error: "Invalid userId", targetUserId: null, requestedUserId };
        }
        return { error: null, targetUserId: requestedUserId, requestedUserId, loggedInUserId };
    }

    return { error: null, targetUserId: loggedInUserId, requestedUserId: "", loggedInUserId };
};

export const getNotifications = async (req, res) => {
    try {
        const { error, targetUserId, requestedUserId, loggedInUserId } = resolveTargetUserId(req);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const notifications = await Notification.find({ userId: targetUserId }).sort({ createdAt: -1 });
        res.json({ success: true, notifications });

        // Only mark notifications as read when the owner themselves views them
        if (!requestedUserId || String(requestedUserId) === String(loggedInUserId)) {
            await Notification.updateMany({ userId: targetUserId, read: false }, { $set: { read: true } });
        }
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const deleteNotifications = async (req, res) => {
    try {
        const { error, targetUserId } = resolveTargetUserId(req);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const notificationId = req.params.id;
        const notification = await Notification.findOneAndDelete({ _id: notificationId, userId: targetUserId });

        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }
        res.json({ success: true, message: "Notification deleted successfully" });
    } catch (error) {
        console.error("Error deleting notification:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const deleteAllNotifications = async (req, res) => {
    try {
        const { error, targetUserId } = resolveTargetUserId(req);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        await Notification.deleteMany({ userId: targetUserId });
        res.json({ success: true, message: "All notifications deleted successfully" });
    } catch (error) {
        console.error("Error deleting all notifications:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
