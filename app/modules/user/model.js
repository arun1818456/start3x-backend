import mongoose from 'mongoose';

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
    isSetupComplete: {
        type: Boolean,
        default: false,
    },
    profileUrl: {
        type: String,
        default: '',
    },
    deviceToken: {
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

const User = mongoose.model('User', userSchema);

export default User;
