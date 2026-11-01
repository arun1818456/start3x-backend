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
    responseNumber: {
        type: String,
        default: 'Response #1',
    },
    outcome: {
        type: String,
        required: true,
    },
    scheduledDate: {
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
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    versionKey: false,
    collection: 'responses',
});

const CallResponse = mongoose.model('CallResponse', callResponseSchema);

export default CallResponse;
