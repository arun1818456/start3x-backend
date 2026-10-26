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

const passkeySchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
    },

    passkey: {
        type: String,
    },

    name: {
        type: String,
        default: 'Ramananda',
    },

    isActive: {
        type: Boolean,
        default: true,
    },

    createdBy: {
        type: String,
        default: 'Admin',
    },

    rank: {
        type: String,
        default: '#1',
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
    _id: false,
    versionKey: false,
});

const Passkey = mongoose.model('Passkey', passkeySchema);

export default Passkey;
