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
        console.log("📥 Generate Passkey Request from User:", req.user?.name || req.user?.email || "Admin");

        // 1. Get creator name from authenticated user's JWT token
        const creatorName = req.user?.name || req.user?.email || "Admin";

        // 2. Generate unique 12-character passkey string
        let generatedKey = generateRandomKey();
        let existing = await Passkey.findOne({ $or: [{ _id: generatedKey }, { passkey: generatedKey }] });
        while (existing) {
            generatedKey = generateRandomKey();
            existing = await Passkey.findOne({ $or: [{ _id: generatedKey }, { passkey: generatedKey }] });
        }

        // 3. Auto-calculate rank #1, #2, #3, etc.
        const totalPasskeys = await Passkey.countDocuments();
        const passkeyRank = `#${totalPasskeys + 1}`;

        // 4. Set assigned name to "XXXXXXXXX" as requested
        const passkeyName = "XXXXXXXXX";

        // 5. Create Passkey document in MongoDB
        const newPasskey = await Passkey.create({
            _id: generatedKey,
            passkey: generatedKey,
            rank: passkeyRank,
            name: passkeyName,
            createdBy: creatorName,
        });

        console.log("✅ Created Passkey Doc:", newPasskey.toObject());

        // 6. Return response object with generated passkey
        return sendResponse(res, 200, true, "Passkey generated successfully", newPasskey.toObject());
    } catch (error) {
        console.error("Generate Passkey Error:", error);
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

// ✅ VERIFY PASSKEY
export const verifyPasskey = async (req, res) => {
    try {
        const { passkey, _id } = req.body || {};
        const keyToVerify = _id || passkey;

        if (!keyToVerify) {
            return sendResponse(res, 400, false, "Passkey is required");
        }

        const found = await Passkey.findOne({
            $or: [{ _id: keyToVerify.trim() }, { passkey: keyToVerify.trim() }]
        });

        if (!found) {
            return sendResponse(res, 404, false, "Invalid Passkey. Please check with Admin");
        }

        return sendResponse(res, 200, true, "Passkey verified successfully", found);
    } catch (error) {
        console.error("Verify Passkey Error:", error);
        return sendResponse(res, 500, false, "Error verifying passkey", null, error.message);
    }
};

// ✅ DELETE PASSKEY
export const deletePasskey = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Passkey.findOneAndDelete({
            $or: [{ _id: id }, { passkey: id }]
        });

        if (!deleted) {
            return sendResponse(res, 404, false, "Passkey not found");
        }

        return sendResponse(res, 200, true, "Passkey removed successfully", deleted);
    } catch (error) {
        console.error("Delete Passkey Error:", error);
        return sendResponse(res, 500, false, "Error deleting passkey", null, error.message);
    }
};
