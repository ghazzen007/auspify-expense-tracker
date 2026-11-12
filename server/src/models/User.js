const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { CURRENCIES } = require("../config/categories");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      minlength: [2, "Name must have at least 2 characters."],
      maxlength: [60, "Name must have at most 60 characters."],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email address."],
    },
    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [8, "Password must have at least 8 characters."],
      validate: {
        validator: (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
        message: "Password must contain at least one letter and one number.",
      },
      select: false, // never returned by queries unless asked for explicitly
    },
    currency: {
      type: String,
      enum: { values: CURRENCIES, message: "Choose a supported currency." },
      default: "TND",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash the password whenever it is set or changed (runs after validation)
userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  const rounds = process.env.NODE_ENV === "test" ? 4 : 12;
  this.password = await bcrypt.hash(this.password, rounds);
});

userSchema.methods.checkPassword = function checkPassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
