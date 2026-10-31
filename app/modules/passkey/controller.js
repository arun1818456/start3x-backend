import Passkey from "./model.js";
import User from "../user/model.js";
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
            isActive: true,
            clientInfo: {
                isSetupComplete: false,
            },
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

// ✅ TOGGLE PASSKEY STATUS (ON / OFF)
export const togglePasskeyStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body || {};

        const passkeyDoc = await Passkey.findOne({ $or: [{ _id: id }, { passkey: id }] });
        if (!passkeyDoc) {
            return sendResponse(res, 404, false, "Passkey not found");
        }

        passkeyDoc.isActive = typeof isActive === 'boolean' ? isActive : !passkeyDoc.isActive;
        await passkeyDoc.save();

        console.log(`✅ Toggled Passkey ${id} Status -> isActive: ${passkeyDoc.isActive}`);

        return sendResponse(
            res,
            200,
            true,
            `Passkey ${passkeyDoc.isActive ? 'activated' : 'deactivated'} successfully`,
            passkeyDoc.toObject()
        );
    } catch (error) {
        console.error("Toggle Passkey Error:", error);
        return sendResponse(res, 500, false, "Error updating passkey status", null, error.message);
    }
};

// ✅ SAVE / UPDATE CLIENT INFO IN PASSKEY MODEL ONLY & SET isSetupComplete = true FOR ALL USERS ON THIS PASSKEY
export const updateClientInfo = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    console.log("📥 Update Client Info request received for user:", userId, req.body || {});

    // 1. Find User to get their assigned passkey
    const userDoc = await User.findById(userId);
    if (!userDoc || !userDoc.passkey) {
      return sendResponse(res, 400, false, "User passkey not found");
    }

    const userPasskeyStr = userDoc.passkey;

    // 2. Find Passkey document in Passkey collection
    const passkeyDoc = await Passkey.findOne({
      $or: [{ _id: userPasskeyStr }, { passkey: userPasskeyStr }]
    });

    if (!passkeyDoc) {
      return sendResponse(res, 404, false, "Passkey document not found");
    }

    const {
      legalName,
      companyName,
      gstName,
      gstNumber,
      phone,
      targetedLocation,
      fullAddress,
      onGrid3kW,
      onGrid4kW,
      onGrid5kW,
      hybrid3kW,
      hybrid4kW,
      hybrid5kW,
      inverterSpec,
      batterySpec,
    } = req.body || {};

    const updatedClientInfo = {
      legalName: legalName || '',
      companyName: companyName || '',
      gstName: gstName || '',
      gstNumber: gstNumber || '',
      phone: phone || '',
      targetedLocation: targetedLocation || '',
      fullAddress: fullAddress || '',
      onGrid3kW: onGrid3kW || '',
      onGrid4kW: onGrid4kW || '',
      onGrid5kW: onGrid5kW || '',
      hybrid3kW: hybrid3kW || '',
      hybrid4kW: hybrid4kW || '',
      hybrid5kW: hybrid5kW || '',
      inverterSpec: inverterSpec || '',
      batterySpec: batterySpec || '',
      isSetupComplete: true,
    };

    // Save full clientInfo in PASSKEY document ONLY!
    passkeyDoc.clientInfo = updatedClientInfo;
    if (companyName) passkeyDoc.name = companyName;
    await passkeyDoc.save();

    // In USER document, ONLY set isSetupComplete = true! (Do NOT overwrite User's registered name)
    await User.updateMany(
      { passkey: userPasskeyStr },
      {
        $set: {
          isSetupComplete: true,
        },
      }
    );

    console.log(`✅ Saved full clientInfo in PASSKEY model ONLY. Updated isSetupComplete = true for users.`);

    const updatedCurrentUser = await User.findById(userId).select('-password');
    const userObj = updatedCurrentUser.toObject();

    return sendResponse(res, 200, true, "Client details saved in Passkey model successfully", userObj);
  } catch (error) {
    console.error("Update Client Info Error:", error);
    return sendResponse(res, 500, false, "Error updating client info", null, error.message);
  }
};
