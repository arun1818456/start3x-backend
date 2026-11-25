import jwt from "jsonwebtoken";
import User from "../modules/user/model.js";

const isSessionMismatch = (dbUser, decodedUser) => {
  if (!dbUser.activeSessionId) return false;
  if (dbUser.activeSessionId === "LOGGED_OUT") return true;
  return !decodedUser.sessionId || decodedUser.sessionId !== dbUser.activeSessionId;
};

export default async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Please authenticate",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token || !token.trim()) {
      return res.status(401).json({
        success: false,
        message: "Please authenticate",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = decoded.user || decoded;

    // Check user exists in database
    const dbUser = await User.findById(user.id || user._id);

    if (!dbUser) {
      return res.status(401).json({
        success: false,
        message: "Please authenticate",
        userNotFound: true,
      });
    }

    if (isSessionMismatch(dbUser, user)) {
      return res.status(401).json({
        success: false,
        sessionExpired: true,
        message:
          dbUser.activeSessionId === "LOGGED_OUT"
            ? "Please authenticate"
            : "Your account is logged in on another device. Please login again.",
      });
    }

    req.user = dbUser;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Please authenticate",
        tokenExpired: true,
      });
    }

    return res.status(401).json({
      success: false,
      message: "Please authenticate",
    });
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token && token.trim().length > 0) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = decoded.user || decoded;
        const dbUser = await User.findById(user.id || user._id);
        if (dbUser) {
          if (isSessionMismatch(dbUser, user)) {
            return res.status(401).json({
              success: false,
              sessionExpired: true,
              message:
                dbUser.activeSessionId === "LOGGED_OUT"
                  ? "Please authenticate"
                  : "Your account is logged in on another device. Please login again.",
            });
          }
          req.user = dbUser;
        }
      }
    }
  } catch (_) {
    // Ignore invalid/missing optional token
  }
  next();
}
