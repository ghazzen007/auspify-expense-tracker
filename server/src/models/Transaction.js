const mongoose = require("mongoose");
const { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } = require("../config/categories");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: [true, "Choose income or expense."],
      enum: { values: ["income", "expense"], message: "Type must be income or expense." },
    },
    amount: {
      type: Number,
      required: [true, "Amount is required."],
      min: [0.01, "Amount must be greater than zero."],
      max: [1e9, "Amount is too large."],
      // Store money rounded to 3 decimals (enough for TND millimes)
      set: (value) => (value === null || value === undefined || value === "" ? value : Math.round(Number(value) * 1000) / 1000),
    },
    category: {
      type: String,
      required: [true, "Category is required."],
      validate: {
        validator(value) {
          const list = this.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
          return list.includes(value);
        },
        message: "Choose a category that matches the transaction type.",
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [120, "Description must have at most 120 characters."],
      default: "",
    },
    date: {
      type: Date,
      required: [true, "Date is required."],
      validate: {
        validator: (value) => value.getTime() <= Date.now() + 366 * 24 * 3600 * 1000,
        message: "Date can't be more than a year in the future.",
      },
    },
    paymentMethod: {
      type: String,
      enum: { values: PAYMENT_METHODS, message: "Choose a valid payment method." },
      default: "Card",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Most queries are "this user's transactions in a date range, newest first"
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1, category: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
