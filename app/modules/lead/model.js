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
    company: {
        type: String,
        default: 'Sunrays',
    },
    date: {
        type: String,
        default: Date.now(),
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
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    versionKey: false,
});

const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
