const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");

/**
 * Aggregation helpers. They let MongoDB add the numbers up ($match + $group)
 * instead of loading every transaction into Node.
 */

const round = (value) => Math.round(value * 1000) / 1000;

function matchStage(userId, { start, end, type, category } = {}) {
  const match = { user: new mongoose.Types.ObjectId(String(userId)) };
  if (start || end) {
    match.date = {};
    if (start) match.date.$gte = start;
    if (end) match.date.$lt = end;
  }
  if (type) match.type = type;
  if (category) match.category = category;
  return match;
}

/** { income, expense, net } for a user and an optional date range */
async function totalsByType(userId, range = {}) {
  const rows = await Transaction.aggregate([
    { $match: matchStage(userId, range) },
    { $group: { _id: "$type", total: { $sum: "$amount" } } },
  ]);
  const income = round(rows.find((r) => r._id === "income")?.total || 0);
  const expense = round(rows.find((r) => r._id === "expense")?.total || 0);
  return { income, expense, net: round(income - expense) };
}

/** [{ category, total }] sorted by total, for one transaction type */
async function totalsByCategory(userId, type, range = {}) {
  const rows = await Transaction.aggregate([
    { $match: matchStage(userId, { ...range, type }) },
    { $group: { _id: "$category", total: { $sum: "$amount" } } },
    { $sort: { total: -1 } },
  ]);
  return rows.map((r) => ({ category: r._id, total: round(r.total) }));
}

module.exports = { totalsByType, totalsByCategory, matchStage, round };
