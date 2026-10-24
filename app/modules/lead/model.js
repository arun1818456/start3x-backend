import mongoose from 'mongoose';

const leadResponseSchema = new mongoose.Schema({
    responseNumber: String,
    outcome: String,
    meetingScheduled: String,
    callback: String,
    text: String,
    callDate: String,
}, { _id: true });

const leadSchema = new mongoose.Schema({
    passkey: {
        type: String,
        required: true,
        index: true,
    },
    rank: {
        type: String,
        default: '#1',
    },
    name: {
        type: String,
        required: true,
    },
    location: {
        type: String,
        default: 'chandigarh',
    },
    company: {
        type: String,
        default: 'Sunrays',
    },
    status: {
        type: String,
        default: 'To-Do:',
    },
    date: {
        type: String,
        default: 'October 23, 2026',
    },
    phoneNumber: {
        type: String,
        default: '',
    },
    altPhoneNumber: {
        type: String,
        default: '',
    },
    kw: {
        type: String,
        default: '',
    },
    electricityBill: {
        type: String,
        default: '',
    },
    textNote: {
        type: String,
        default: '',
    },
    responses: [leadResponseSchema],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    versionKey: false,
});

const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
