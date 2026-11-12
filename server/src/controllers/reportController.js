const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const ApiError = require("../utils/ApiError");
const { currentMonthKey, monthRange, shiftMonth, dayRange, monthsBetween } = require("../utils/dates");
const { totalsByType, totalsByCategory, matchStage, round } = require("../utils/totals");

const share = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/**
 * GET /api/reports/summary?month=2026-11
 * Everything the dashboard needs for one month in a single request.
 */
async function monthSummary(req, res) {
  const month = req.query.month || currentMonthKey();
  const range = monthRange(month);
  const previous = monthRange(shiftMonth(month, -1));
  const userId = req.user._id;

  const [totals, previousTotals, allTime, byCategory, budgets, recent, monthExpenses] = await Promise.all([
    totalsByType(userId, range),
    totalsByType(userId, previous),
    totalsByType(userId, { end: range.end }),
    totalsByCategory(userId, "expense", range),
    Budget.find({ user: userId }).lean(),
    Transaction.find({ user: userId }).sort({ date: -1, createdAt: -1 }).limit(6),
    Transaction.find({ ...matchStage(userId, { ...range, type: "expense" }) }, "amount date").lean(),
  ]);

  // Day-by-day running total of spending, for the "spending so far" chart
  const daysInMonth = Math.round((range.end - range.start) / 86400000);
  const perDay = new Array(daysInMonth).fill(0);
  for (const t of monthExpenses) perDay[t.date.getUTCDate() - 1] += t.amount;
  let running = 0;
  const cumulative = perDay.map((amount, i) => {
    running += amount;
    return { day: i + 1, total: round(running) };
  });

  const spentBy = Object.fromEntries(byCategory.map((c) => [c.category, c.total]));

  res.json({
    month,
    totals: { ...totals, savingsRate: totals.income > 0 ? share(totals.net, totals.income) : null },
    previousTotals,
    balance: allTime.net,
    expenseByCategory: byCategory.map((c) => ({ ...c, share: share(c.total, totals.expense) })),
    budgets: budgets
      .map((b) => ({
        category: b.category,
        limit: b.monthlyLimit,
        spent: spentBy[b.category] || 0,
        used: share(spentBy[b.category] || 0, b.monthlyLimit),
      }))
      .sort((a, b) => b.used - a.used),
    cumulativeSpending: cumulative,
    recent,
  });
}

/** GET /api/reports/trend?months=6&end=2026-11 — income vs expense per month */
async function trend(req, res) {
  const count = Math.min(Math.max(parseInt(req.query.months, 10) || 6, 1), 24);
  const end = req.query.end || currentMonthKey();
  const keys = Array.from({ length: count }, (_, i) => shiftMonth(end, i - count + 1));

  const months = await Promise.all(
    keys.map(async (key) => ({ month: key, ...(await totalsByType(req.user._id, monthRange(key))) }))
  );
  res.json({ months });
}

/**
 * GET /api/reports/range?from=2026-01-01&to=2026-11-30
 * Totals, category breakdowns, month-by-month figures and the biggest expenses for any period.
 */
async function rangeReport(req, res) {
  if (!req.query.from || !req.query.to) throw ApiError.badRequest("Choose a start and an end date.");
  const range = dayRange(req.query.from, req.query.to);
  const keys = monthsBetween(range.start, range.end);
  if (keys.length > 36) throw ApiError.badRequest("Reports can cover at most 36 months.");
  const userId = req.user._id;

  const [totals, expenseByCategory, incomeByCategory, topExpenses, monthly] = await Promise.all([
    totalsByType(userId, range),
    totalsByCategory(userId, "expense", range),
    totalsByCategory(userId, "income", range),
    Transaction.find(matchStage(userId, { ...range, type: "expense" })).sort({ amount: -1 }).limit(5),
    Promise.all(
      keys.map(async (key) => {
        const m = monthRange(key);
        const clipped = { start: m.start < range.start ? range.start : m.start, end: m.end > range.end ? range.end : m.end };
        return { month: key, ...(await totalsByType(userId, clipped)) };
      })
    ),
  ]);

  const days = Math.max(Math.round((range.end - range.start) / 86400000), 1);

  res.json({
    from: req.query.from,
    to: req.query.to,
    totals: { ...totals, savingsRate: totals.income > 0 ? share(totals.net, totals.income) : null },
    averageDailySpending: round(totals.expense / days),
    expenseByCategory: expenseByCategory.map((c) => ({ ...c, share: share(c.total, totals.expense) })),
    incomeByCategory: incomeByCategory.map((c) => ({ ...c, share: share(c.total, totals.income) })),
    monthly,
    topExpenses,
  });
}

module.exports = { monthSummary, trend, rangeReport };
