import mongoose from 'mongoose';

const clientInfoSchema = new mongoose.Schema({
    legalName: { type: String, default: '' },
    companyName: { type: String, default: '' },
    gstName: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    phone: { type: String, default: '' },
    targetedLocation: { type: String, default: '' },
    fullAddress: { type: String, default: '' },
    onGrid3kW: { type: String, default: '' },
    onGrid4kW: { type: String, default: '' },
    onGrid5kW: { type: String, default: '' },
    hybrid3kW: { type: String, default: '' },
    hybrid4kW: { type: String, default: '' },
    hybrid5kW: { type: String, default: '' },
    inverterSpec: { type: String, default: '' },
    batterySpec: { type: String, default: '' },
    isSetupComplete: { type: Boolean, default: false },
}, { _id: false });

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user',
    },
    passkey: {
        type: String,
        default: '',
    },
    clientInfo: {
        type: clientInfoSchema,
        default: () => ({}),
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    versionKey: false,
});

const User = mongoose.model('User', userSchema);

export default User;
