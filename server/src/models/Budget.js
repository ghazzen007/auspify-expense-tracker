const mongoose = require("mongoose");
const { EXPENSE_CATEGORIES } = require("../config/categories");

/** A monthly spending limit for one expense category of one user */
const budgetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: { values: EXPENSE_CATEGORIES, message: "Budgets can only be set on expense categories." },
    },
    monthlyLimit: {
      type: Number,
      required: [true, "Monthly limit is required."],
      min: [1, "Monthly limit must be at least 1."],
      max: [1e9, "Monthly limit is too large."],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

budgetSchema.index({ user: 1, category: 1 }, { unique: true });

module.exports = mongoose.model("Budget", budgetSchema);
