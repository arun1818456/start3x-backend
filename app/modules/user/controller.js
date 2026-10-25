import User from "./model.js";
import Passkey from "../passkey/model.js";
import bcrypt from "bcryptjs";
import { jwtTokenGenerator } from "../../utils/generateJWTtoken.js";
import { sendResponse } from "../../utils/sendResposeType.js";

// ✅ REGISTER USER
export const RegisterUser = async (req, res) => {
  try {
    const { name, email: rawEmail, password, passkey: rawPasskey, role } = req.body || {};

    const email = rawEmail?.trim()?.toLowerCase();
    const passkey = typeof rawPasskey === "string" ? rawPasskey.trim() : "";

    if (!email || !password || !passkey) {
      return sendResponse(res, 400, false, "Email, password, and passkey are required");
    }

    const validPasskey = await Passkey.findOne({
      $or: [{ _id: passkey }, { passkey }],
    });

    if (!validPasskey) {
      return sendResponse(res, 400, false, "Invalid passkey");
    }

    if (!validPasskey.isActive) {
      return sendResponse(res, 403, false, "Passkey is inactive");
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
    const { email, password, passkey } = req.body || {};
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
