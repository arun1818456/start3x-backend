import mongoose from 'mongoose';

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
    createdBy: {
        type: String,
        default: 'Admin',
    },
    rank: {
        type: String,
        default: '#1',
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
