const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");

const COOKIE_NAME = "mizan_token";
const TOKEN_TTL_DAYS = 7;

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set to a random string of at least 32 characters.");
  }
  return secret;
}

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, jwtSecret(), { expiresIn: `${TOKEN_TTL_DAYS}d` });
}

/**
 * Sends the token as an httpOnly cookie (not readable by JavaScript, so an XSS bug
 * can't steal it). SameSite=Lax blocks it from being sent by other sites' forms.
 */
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/**
 * Protects a route. Accepts the cookie (browser) or an
 * "Authorization: Bearer <token>" header (Postman, scripts).
 */
async function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : req.cookies?.[COOKIE_NAME];
  if (!token) throw new ApiError(401, "Please sign in to continue.");

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret());
  } catch {
    clearAuthCookie(res);
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    clearAuthCookie(res);
    throw new ApiError(401, "This account no longer exists.");
  }

  req.user = user;
  next();
}

/** Like requireAuth, but lets visitors through with req.user = null */
async function optionalAuth(req, res, next) {
  try {
    await requireAuth(req, res, () => {});
  } catch {
    req.user = null;
  }
  next();
}

module.exports = { requireAuth, optionalAuth, signToken, setAuthCookie, clearAuthCookie, COOKIE_NAME };
