import mongoose from 'mongoose';

const callResponseSchema = new mongoose.Schema({
    passkey: {
        type: String,
        required: true,
        index: true,
    },
    leadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
        required: true,
        index: true,
    },
    phoneNumber: {
        type: String,
        default: '',
        index: true,
    },
    responseNumber: {
        type: String,
        default: 'Response #1',
    },
    outcome: {
        type: String,
        required: true,
    },
    meetingScheduled: {
        type: String,
        default: null,
    },
    callback: {
        type: String,
        default: null,
    },
    text: {
        type: String,
        default: '',
    },
    reminder: {
        type: String,
        default: null,
    },
    callDate: {
        type: String,
        default: '',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    versionKey: false,
});

const CallResponse = mongoose.model('CallResponse', callResponseSchema);

export default CallResponse;
