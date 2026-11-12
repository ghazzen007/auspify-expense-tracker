const Budget = require("../models/Budget");
const ApiError = require("../utils/ApiError");
const { currentMonthKey, monthRange } = require("../utils/dates");
const { totalsByCategory } = require("../utils/totals");
const { EXPENSE_CATEGORIES } = require("../config/categories");

function assertCategory(category) {
  if (!EXPENSE_CATEGORIES.includes(category)) {
    throw ApiError.badRequest("Budgets can only be set on expense categories.");
  }
}

/** GET /api/budgets?month=2026-11 — every expense category with its limit (if any) and spending */
async function listBudgets(req, res) {
  const month = req.query.month || currentMonthKey();
  const [budgets, spending] = await Promise.all([
    Budget.find({ user: req.user._id }).lean(),
    totalsByCategory(req.user._id, "expense", monthRange(month)),
  ]);
  const limitBy = Object.fromEntries(budgets.map((b) => [b.category, b.monthlyLimit]));
  const spentBy = Object.fromEntries(spending.map((s) => [s.category, s.total]));

  res.json({
    month,
    categories: EXPENSE_CATEGORIES.map((category) => ({
      category,
      limit: limitBy[category] ?? null,
      spent: spentBy[category] || 0,
    })),
  });
}

/** PUT /api/budgets/:category — create or change a monthly limit */
async function setBudget(req, res) {
  const { category } = req.params;
  assertCategory(category);
  const monthlyLimit = Number(req.body.monthlyLimit);
  const budget = await Budget.findOneAndUpdate(
    { user: req.user._id, category },
    { monthlyLimit },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
  );
  res.json(budget);
}

/** DELETE /api/budgets/:category */
async function removeBudget(req, res) {
  const { category } = req.params;
  assertCategory(category);
  const result = await Budget.deleteOne({ user: req.user._id, category });
  if (!result.deletedCount) throw ApiError.notFound("There is no budget for this category.");
  res.json({ message: `Budget for ${category} removed.` });
}

module.exports = { listBudgets, setBudget, removeBudget };
