const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const ApiError = require("../utils/ApiError");
const { signToken, setAuthCookie, clearAuthCookie } = require("../middleware/auth");

const clean = (value) => (typeof value === "string" ? value.trim() : value);

function sendSession(res, user, status = 200) {
  const token = signToken(user.id);
  setAuthCookie(res, token);
  // The token is also returned so API clients like Postman can use a Bearer header
  res.status(status).json({ user, token });
}

/** POST /api/auth/register */
async function register(req, res) {
  const { name, email, password, currency } = req.body;
  const exists = await User.findOne({ email: clean(email)?.toLowerCase() });
  if (exists) {
    throw new ApiError(409, "An account with this email already exists.", {
      email: "An account with this email already exists. Sign in instead.",
    });
  }
  const user = await User.create({ name: clean(name), email: clean(email), password, currency });
  sendSession(res, user, 201);
}

/** POST /api/auth/login */
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    throw ApiError.badRequest("Enter your email and password.");
  }
  const user = await User.findOne({ email: clean(email).toLowerCase() }).select("+password");
  // Same message for both cases so the form doesn't reveal which emails exist
  if (!user || !(await user.checkPassword(password))) {
    throw new ApiError(401, "Email or password is incorrect.");
  }
  sendSession(res, user);
}

/** POST /api/auth/logout */
function logout(req, res) {
  clearAuthCookie(res);
  res.json({ message: "Signed out." });
}

/** GET /api/auth/me */
function me(req, res) {
  res.json({ user: req.user });
}

/** PATCH /api/auth/me — update name and currency */
async function updateMe(req, res) {
  const changes = {};
  if (req.body.name !== undefined) changes.name = clean(req.body.name);
  if (req.body.currency !== undefined) changes.currency = req.body.currency;
  // req.user was loaded without the password field, so saving it leaves the password untouched
  req.user.set(changes);
  await req.user.save();
  res.json({ user: req.user });
}

/** PATCH /api/auth/password */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id).select("+password");
  if (!currentPassword || !(await user.checkPassword(currentPassword))) {
    throw new ApiError(400, "Your current password is incorrect.", { currentPassword: "Your current password is incorrect." });
  }
  user.password = newPassword;
  try {
    await user.save();
  } catch (error) {
    // Report the error on the field the person actually typed in
    if (error.errors?.password) {
      throw new ApiError(400, error.errors.password.message, { newPassword: error.errors.password.message });
    }
    throw error;
  }
  res.json({ message: "Password updated." });
}

/** DELETE /api/auth/me — delete the account and all its data */
async function deleteMe(req, res) {
  await Promise.all([Transaction.deleteMany({ user: req.user.id }), Budget.deleteMany({ user: req.user.id })]);
  await User.deleteOne({ _id: req.user.id });
  clearAuthCookie(res);
  res.json({ message: "Your account and all its data were deleted." });
}

module.exports = { register, login, logout, me, updateMe, changePassword, deleteMe };
