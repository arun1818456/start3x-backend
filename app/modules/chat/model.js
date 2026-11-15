import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
    passkey: {
        type: String,
        default: 'default',
        index: true,
    },
    senderId: {
        type: String,
        default: '',
    },
    senderName: {
        type: String,
        required: true,
        default: 'User',
    },
    messageText: {
        type: String,
        required: true,
        default: '',
    },
    messageType: {
        type: String,
        enum: ['text', 'flagged_lead', 'system'],
        default: 'text',
    },
    flaggedLeads: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    versionKey: false,
});

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;
