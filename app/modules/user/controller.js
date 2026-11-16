import User from "./model.js";
import Passkey from "../passkey/model.js";
import bcrypt from "bcryptjs";
import { jwtTokenGenerator } from "../../utils/generateJWTtoken.js";
import { sendResponse } from "../../utils/sendResposeType.js";

// ✅ REGISTER USER
export const RegisterUser = async (req, res) => {
  try {
    console.log("📥 Register user request received:", req.body || {});
    let { name, email, password, passkey, deviceToken } = req.body || {};
    const userName = (name || '').trim();

    email = email?.trim()?.toLowerCase();

    if (!email || !password || !name ) {
      return sendResponse(res, 400, false, "Email, password, and full name are required");
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

    // Check if passkey setup is already complete
    let isSetupComplete = false;
    if (validPasskeyDoc && validPasskeyDoc.clientInfo && validPasskeyDoc.clientInfo.isSetupComplete) {
      isSetupComplete = true;
      console.log("🎯 Passkey setup is ALREADY complete! Setting isSetupComplete = true for new user");
    }

    const newUser = await User.create({
      name: name || '',
      email,
      password: hashedPassword,
      role: "user",
      passkey: passkey || '',
      isSetupComplete: isSetupComplete,
      deviceToken: deviceToken ? deviceToken.trim() : '',
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
    const { email, password, deviceToken } = req.body || {};
    console.log("📥 Login request received:", req.body || {});
    if (!email || !password) {
      return sendResponse(res, 400, false, "Email and password are required");
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return sendResponse(res, 400, false, "Invalid email or password");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return sendResponse(res, 400, false, "Invalid email or password");

    // Update device token if provided
    if (deviceToken && typeof deviceToken === 'string' && deviceToken.trim().length > 0) {
      user.deviceToken = deviceToken.trim();
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

// ✅ GOOGLE LOGIN / SIGNUP USER
export const googleLoginUser = async (req, res) => {
  console.log("📥 Google login request received:", req.body || {});

  try {
    let { email, name, profileUrl, passkey, deviceToken } = req.body || {};

    if (!email || !name) {
      return sendResponse(res, 400, false, "Email and name are required");
    }

    email = email.trim().toLowerCase();
    passkey = passkey ? passkey.trim() : '';

    // 🔎 Check if user exists in Database
    let user = await User.findOne({ email });

    // 1️⃣ EXISTING USER WITH PASSKEY OR ADMIN -> DIRECT LOGIN
    if (user && (user.role === 'admin' || (user.passkey && user.passkey.trim().length > 0))) {
      // Sync latest isSetupComplete from Passkey if available
      if (user.passkey) {
        const passkeyDoc = await Passkey.findOne({
          $or: [{ _id: user.passkey }, { passkey: user.passkey }]
        });
        if (passkeyDoc && passkeyDoc.clientInfo && passkeyDoc.clientInfo.isSetupComplete) {
          user.isSetupComplete = true;
        }
      }

      if (profileUrl && !user.profileUrl) {
        user.profileUrl = profileUrl;
      }
      if (deviceToken && typeof deviceToken === 'string' && deviceToken.trim().length > 0) {
        user.deviceToken = deviceToken.trim();
      }
      await user.save();

      const token = jwtTokenGenerator(user._id);
      const userObj = user.toObject();
      delete userObj.password;

      const userData = {
        ...userObj,
        token: token,
      };

      console.log("✅ Google Direct Login Success:", userData);
      return sendResponse(res, 200, true, "Google login successful", {
        requiresPasskey: false,
        ...userData,
      });
    }

    // 2️⃣ NEW USER OR USER WITHOUT PASSKEY -> REQUIRES PASSKEY
    if (!passkey) {
      console.log("⚠️ Passkey required for new user or account without passkey:", email);
      return sendResponse(res, 200, true, "Passkey required", {
        requiresPasskey: true,
        email: email,
        name: name,
      });
    }

    // 3️⃣ VERIFY PASSKEY & COMPLETE SIGNUP
    const validPasskeyDoc = await Passkey.findOne({
      $or: [{ _id: passkey }, { passkey: passkey }]
    });

    if (!validPasskeyDoc) {
      return sendResponse(res, 400, false, "Invalid Passkey. Please check with Admin");
    }

    if (validPasskeyDoc.isActive === false) {
      return sendResponse(res, 400, false, "This passkey has been deactivated by Admin");
    }

    let isSetupComplete = false;
    if (validPasskeyDoc.clientInfo && validPasskeyDoc.clientInfo.isSetupComplete) {
      isSetupComplete = true;
      console.log("🎯 Passkey setup is ALREADY complete! Setting isSetupComplete = true");
    }

    if (user) {
      // User exists in DB but didn't have passkey -> update user
      user.passkey = passkey;
      user.isSetupComplete = isSetupComplete;
      if (profileUrl) user.profileUrl = profileUrl;
      if (deviceToken && typeof deviceToken === 'string' && deviceToken.trim().length > 0) {
        user.deviceToken = deviceToken.trim();
      }
      await user.save();
    } else {
      // New User -> create account
      const dummyPassword = await bcrypt.hash("google_oauth_dummy_passwordW$^%&R^&Y*U(", 10);
      user = await User.create({
        name: name.trim(),
        email,
        password: dummyPassword,
        role: "user",
        passkey: passkey,
        profileUrl: profileUrl || '',
        deviceToken: deviceToken ? deviceToken.trim() : '',
        isSetupComplete: isSetupComplete,
      });
    }

    // Generate fresh JWT Token
    const token = jwtTokenGenerator(user._id);
    const userObj = user.toObject();
    delete userObj.password;

    const userData = {
      ...userObj,
      token: token,
    };

    console.log("✅ Google Signup with Passkey Success:", userData);
    return sendResponse(res, 200, true, "Google registration successful", {
      requiresPasskey: false,
      ...userData,
    });

  } catch (error) {
    console.error("Google Login/Signup Error:", error);
    return sendResponse(res, 500, false, "Error in Google login", null, error.message);
  }
};

// ✅ UPDATE DEVICE TOKEN
export const updateDeviceToken = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { deviceToken } = req.body || {};
    if (!deviceToken) {
      return sendResponse(res, 400, false, "Device token is required");
    }
    await User.findByIdAndUpdate(userId, { deviceToken: deviceToken.trim() });
    return sendResponse(res, 200, true, "Device token updated successfully");
  } catch (error) {
    console.error("Update Device Token Error:", error);
    return sendResponse(res, 500, false, "Error updating device token", null, error.message);
  }
};

