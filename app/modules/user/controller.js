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
    const userRole = (role === 'admin' || email === 'admin@gmail.com') ? 'admin' : 'user';

    const newUser = await User.create({
      name: name || (userRole === 'admin' ? 'Admin' : 'User'),
      email,
      password: hashedPassword,
      role: userRole,
      passkey: passkey || '',
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
