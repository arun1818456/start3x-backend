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
    const userId = req.user?._id || req.user?.id;
    console.log("📥 Update Client Info request received for user:", userId, req.body || {}, req.query || {});

    // 1. Resolve target passkey: from body/query (sent by Admin or Client), or from userDoc
    let targetPasskey = req.body?.passkey || req.query?.passkey || req.body?.passkeyId || req.query?.passkeyId || req.body?.id;

    if (!targetPasskey && userId) {
      const userDoc = await User.findById(userId);
      if (userDoc && userDoc.passkey) {
        targetPasskey = userDoc.passkey;
      }
    }

    if (!targetPasskey) {
      return sendResponse(res, 400, false, "Target passkey is required");
    }

    const passkeyStr = targetPasskey.toString().trim();

    // 2. Find Passkey document in Passkey collection
    const passkeyDoc = await Passkey.findOne({
      $or: [{ _id: passkeyStr }, { passkey: passkeyStr }]
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
      inverterName,
      batteryName,
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
      inverterSpec: inverterSpec || inverterName || '',
      batterySpec: batterySpec || batteryName || '',
      inverterName: inverterName || inverterSpec || '',
      batteryName: batteryName || batterySpec || '',
      isSetupComplete: true,
    };

    // Save full clientInfo in PASSKEY document
    passkeyDoc.clientInfo = updatedClientInfo;
    if (companyName) passkeyDoc.name = companyName;
    await passkeyDoc.save();

    // In USER document, set isSetupComplete = true for all users with this passkey
    await User.updateMany(
      { passkey: passkeyStr },
      {
        $set: {
          isSetupComplete: true,
        },
      }
    );

    console.log(`✅ Saved full clientInfo in PASSKEY model for [${passkeyStr}]. Updated isSetupComplete = true for users.`);

    return sendResponse(res, 200, true, "Client details saved in Passkey model successfully", {
      passkey: passkeyDoc.passkey || passkeyDoc._id,
      name: passkeyDoc.name,
      clientInfo: passkeyDoc.clientInfo,
      passkeyDoc: passkeyDoc.toObject(),
    });
  } catch (error) {
    console.error("Update Client Info Error:", error);
    return sendResponse(res, 500, false, "Error updating client info", null, error.message);
  }
};

// ✅ GET PASSKEY DETAILS (INCLUDING CLIENT INFO)
export const getPasskeyDetails = async (req, res) => {
  try {
    let targetPasskey = req.params?.passkey || req.query?.passkey;
    if (!targetPasskey && req.user && req.user.passkey) {
      targetPasskey = req.user.passkey;
    }

    if (!targetPasskey) {
      return sendResponse(res, 400, false, "Passkey parameter is required");
    }

    const passkeyStr = targetPasskey.toString().trim();
    const passkeyDoc = await Passkey.findOne({
      $or: [{ _id: passkeyStr }, { passkey: passkeyStr }]
    });

    if (!passkeyDoc) {
      return sendResponse(res, 404, false, "Passkey not found");
    }

    return sendResponse(res, 200, true, "Passkey details fetched successfully", passkeyDoc.toObject());
  } catch (error) {
    console.error("Get Passkey Details Error:", error);
    return sendResponse(res, 500, false, "Error fetching passkey details", null, error.message);
  }
};

// ✅ GET ALL USERS LOGGED IN WITH SPECIFIC PASSKEY
export const getPasskeyUsers = async (req, res) => {
  try {
    const { passkey } = req.params;
    if (!passkey) {
      return sendResponse(res, 400, false, "Passkey parameter is required");
    }

    // Find all users who registered or logged in with this passkey
    const users = await User.find({ passkey })
      .select('-password')
      .sort({ createdAt: -1 });

    return sendResponse(res, 200, true, "Passkey users fetched successfully", users);
  } catch (error) {
    console.error("Get Passkey Users Error:", error);
    return sendResponse(res, 500, false, "Error fetching passkey users", null, error.message);
  }
};
