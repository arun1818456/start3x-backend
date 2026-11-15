import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
    passkey: {
        type: String,
        required: true,
        index: true,
    },
    status: {
        type: String,
        default: 'New',
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
    isCompleted: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

leadSchema.virtual('responses', {
    ref: 'CallResponse',
    localField: '_id',
    foreignField: 'leadId',
});

const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
