import User from "./model.js";
import bcrypt from "bcryptjs";
import { jwtTokenGenerator } from "../../utils/generateJWTtoken.js";
import { sendResponse } from "../../utils/sendResposeType.js";

// ✅ REGISTER USER
export const RegisterUser = async (req, res) => {
  try {
    console.log("📥 Register user request received:", req.body || {});
    let { name, email, password, passkey, role } = req.body;

    email = email?.trim()?.toLowerCase();

    if (!email || !password) {
      return sendResponse(res, 400, false, "Email and password are required");
    }

    // Check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendResponse(res, 400, false, "Email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: name || "User",
      email,
      password: hashedPassword,
      role: role || "user",
      passkey: validPasskey.passkey || validPasskey._id,
    });

    const token = jwtTokenGenerator(newUser._id);
    const userObj = newUser.toObject();
    delete userObj.password;

    const userData = {
      ...userObj,
      token: token,
    };

    return sendResponse(res, 200, true, "User registered successfully", userData);
  } catch (error) {
    console.error("Register Error:", error);
    return sendResponse(res, 500, false, "Error registering user", null, error.message);
  }
};

// ✅ LOGIN USER
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    console.log("📥 Login request received:", req.body || {});
    if (!email || !password) {
      return sendResponse(res, 400, false, "Email and password are required");
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return sendResponse(res, 400, false, "Invalid email or password");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return sendResponse(res, 400, false, "Invalid email or password");

    // Generate fresh JWT Token
    const token = jwtTokenGenerator(user._id);
    const userObj = user.toObject();
    delete userObj.password;
    const userData = {
      ...userObj,
      token: token, 
    };

    return sendResponse(res, 200, true, "Login successful", userData);
  } catch (error) {
    console.error("Login Error:", error);
    return sendResponse(res, 500, false, "Error logging in user", null, error.message);
  }
};

// ✅ UPDATE CLIENT INFO / ONBOARDING SETUP
export const updateClientInfo = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    console.log("📥 Update Client Info request received for user:", userId, req.body || {});

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

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          clientInfo: {
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
          },
          ...(companyName && { name: companyName }),
        },
      },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return sendResponse(res, 404, false, "User not found");
    }

    const userObj = updatedUser.toObject();
    return sendResponse(res, 200, true, "Client info updated successfully", userObj);
  } catch (error) {
    console.error("Update Client Info Error:", error);
    return sendResponse(res, 500, false, "Error updating client info", null, error.message);
  }
};

// ✅ GET USER DETAILS
export const getUserDetails = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }
    return sendResponse(res, 200, true, "User details fetched successfully", user.toObject());
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, false, "Error fetching user details", null, error.message);
  }
};

// ✅ GET ALL CLIENT USERS WITH FULL INFO (FOR ADMIN)
export const getAllClientsInfo = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password').sort({ createdAt: -1 });
    return sendResponse(res, 200, true, "Clients info fetched successfully", users);
  } catch (error) {
    console.error("Get All Clients Error:", error);
    return sendResponse(res, 500, false, "Error fetching clients info", null, error.message);
  }
};
