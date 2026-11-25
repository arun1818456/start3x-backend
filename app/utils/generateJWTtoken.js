import jwt from "jsonwebtoken";

export function jwtTokenGenerator(userId, sessionId = "") {
    const payload = { user: { id: userId, sessionId } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "365d" });
    return token;
}
