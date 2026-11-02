import mongoose from 'mongoose';

const insightSchema = new mongoose.Schema({
    passkey: {
        type: String,
        required: true,
        index: true,
        unique: true,
    },
    callbackMissed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }],
    callbackDone: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }],
    meetingsMissed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }],
    meetingsDone: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }],
    taskDone: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }],
}, {
    timestamps: true,
    versionKey: false,
});

const Insight = mongoose.model('Insight', insightSchema);

export default Insight;
