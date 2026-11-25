import mongoose from "mongoose";

const notificationModel = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
    },
    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    read: {
        type: Boolean,
        default: false,
    },
    type: {
        type: String,
        default: "INFO",
    },
    passkey: {
        type: String,
        default: "",
    },
    leadId: {
        type: String,
        default: "",
    },
}, {
    versionKey: false,
});

export default mongoose.model("notifications", notificationModel);
// Notification Types:
// INFO: General information or updates
// LEAD_ASSIGNED: New lead assigned to passkey
// LEAD_UPDATED: Lead details updated
// RESPONSE_ADDED: Call response / meeting / callback added
// DEAL_CLOSED: Deal closed / conversion recorded
// TASK_REMINDER: Scheduled callback or meeting reminder
// TASK_MISSED: Missed or overdue task alert
// CHAT_MESSAGE: New team group chat message or flagged lead
// CLIENT_SETUP_COMPLETED: Client completed initial business setup
// CLIENT_INFO_UPDATED: Admin/client updated business details
// PASSKEY_STATUS: Passkey activated or deactivated
// TEAM_MEMBER_JOINED: New team member joined under a passkey
// WEB_ENQUIRY: New lead/plan/partner form submitted from web
