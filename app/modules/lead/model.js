import mongoose from 'mongoose';

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
    scheduledDate: {
        type: String,
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
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    versionKey: false,
});

const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
