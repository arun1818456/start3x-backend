import Passkey from "./model.js";
import { sendResponse } from "../../utils/sendResposeType.js";

// Helper function to generate random 12-char passkey string
const generateRandomKey = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// ✅ GENERATE PASSKEY (TOKEN AUTHENTICATED ADMIN)
export const generatePasskey = async (req, res) => {
    try {

        const creatorName = req.user?.name || req.user?.email || "Admin";

        // 2. Generate unique 12-character passkey string
        let generatedKey = generateRandomKey();
        let existing = await Passkey.findOne({ $or: [{ _id: generatedKey }, { passkey: generatedKey }] });
        while (existing) {
            generatedKey = generateRandomKey();
            existing = await Passkey.findOne({ $or: [{ _id: generatedKey }, { passkey: generatedKey }] });
        }

        const totalPasskeys = await Passkey.countDocuments();
        const passkeyRank = `#${totalPasskeys + 1}`;

        const passkeyName = "XXXXXXXXX";

        // 5. Create Passkey document in MongoDB
        const newPasskey = await Passkey.create({
            _id: generatedKey,
            passkey: generatedKey,
            rank: passkeyRank,
            name: passkeyName,
            createdBy: creatorName,
        });
        return sendResponse(res, 200, true, "Passkey generated successfully", newPasskey.toObject());
    } catch (error) {
        return sendResponse(res, 500, false, "Error generating passkey", null, error.message);
    }
};

// ✅ GET ALL PASSKEYS (ADMIN LIST)
export const listPasskeys = async (req, res) => {
    try {
        const passkeys = await Passkey.find().sort({ createdAt: -1 });
        return sendResponse(res, 200, true, "Passkeys fetched successfully", passkeys);
    } catch (error) {
        console.error("List Passkeys Error:", error);
        return sendResponse(res, 500, false, "Error fetching passkeys", null, error.message);
    }
};

// ✅ TOGGLE PASSKEY STATUS
export const togglePasskeyStatus = async (req, res) => {
    try {
        const passkey = await Passkey.findById(req.params.id);

        if (!passkey) {
            return sendResponse(res, 404, false, "Passkey not found");
        }

        passkey.isActive = !passkey.isActive;
        await passkey.save();

        return sendResponse(res, 200, true, "Passkey status updated successfully", passkey);
    } catch (error) {
        console.error("Toggle Passkey Status Error:", error);
        return sendResponse(res, 500, false, "Error updating passkey status", null, error.message);
    }
};
