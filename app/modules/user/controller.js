import User from "./model.js";
import Passkey from "../passkey/model.js";
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

    // Verify Passkey & check if Passkey already has complete clientInfo
    let validPasskeyDoc = null;
    if (passkey) {
      validPasskeyDoc = await Passkey.findOne({
        $or: [{ _id: passkey }, { passkey: passkey }]
      });

      if (!validPasskeyDoc) {
        return sendResponse(res, 400, false, "Invalid Passkey. Please check with Admin");
      }

      if (validPasskeyDoc.isActive === false) {
        return sendResponse(res, 400, false, "This passkey has been deactivated by Admin");
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = (role === 'admin' || email === 'admin@gmail.com') ? 'admin' : 'user';

    // Check if passkey setup is already complete
    let isSetupComplete = false;
    if (validPasskeyDoc && validPasskeyDoc.clientInfo && validPasskeyDoc.clientInfo.isSetupComplete) {
      isSetupComplete = true;
      console.log("🎯 Passkey setup is ALREADY complete! Setting isSetupComplete = true for new user");
    }

    const newUser = await User.create({
      name: name || (validPasskeyDoc?.name && validPasskeyDoc?.name !== 'XXXXXXXXX' ? validPasskeyDoc.name : 'User'),
      email,
      password: hashedPassword,
      role: userRole,
      passkey: passkey || '',
      isSetupComplete: isSetupComplete,
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
    const { email, password, passkey } = req.body || {};
    console.log("📥 Login request received:", req.body || {});
    if (!email || !password) {
      return sendResponse(res, 400, false, "Email and password are required");
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return sendResponse(res, 400, false, "Invalid email or password");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return sendResponse(res, 400, false, "Invalid email or password");

    // Sync isSetupComplete status from Passkey document
    const targetPasskey = passkey || user.passkey;
    if (targetPasskey) {
      user.passkey = targetPasskey;
      const passkeyDoc = await Passkey.findOne({
        $or: [{ _id: targetPasskey }, { passkey: targetPasskey }]
      });
      if (passkeyDoc && passkeyDoc.clientInfo && passkeyDoc.clientInfo.isSetupComplete) {
        user.isSetupComplete = true;
        console.log("🎯 Passkey setup is ALREADY complete! Setting user.isSetupComplete = true on login");
      }
      await user.save();
    }

    // Generate fresh JWT Token
    const token = jwtTokenGenerator(user._id);
    const userObj = user.toObject();
    delete userObj.password;

    const userData = {
      ...userObj,
      token: token,
    };

    console.log("✅ Login Response Data with Token:", userData);

    return sendResponse(res, 200, true, "Login successful", userData);
  } catch (error) {
    console.error("Login Error:", error);
    return sendResponse(res, 500, false, "Error logging in user", null, error.message);
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
