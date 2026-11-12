const Transaction = require("../models/Transaction");
const ApiError = require("../utils/ApiError");
const { dayRange, parseDay } = require("../utils/dates");
const { totalsByType } = require("../utils/totals");
const { EXPENSE_CATEGORIES, INCOME_CATEGORIES } = require("../config/categories");

const EDITABLE = ["type", "amount", "category", "description", "date", "paymentMethod"];

const SORTS = {
  newest: { date: -1, createdAt: -1 },
  oldest: { date: 1, createdAt: 1 },
  "amount-desc": { amount: -1, date: -1 },
  "amount-asc": { amount: 1, date: -1 },
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function pickEditable(body = {}) {
  const data = {};
  for (const field of EDITABLE) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (typeof data.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    data.date = parseDay(data.date, "date");
  }
  return data;
}

/** Turns query-string filters into a MongoDB filter scoped to the signed-in user */
function buildFilter(userId, query) {
  const filter = { user: userId };
  const { type, category, from, to, search } = query;

  if (type) {
    if (!["income", "expense"].includes(type)) throw ApiError.badRequest("Type must be income or expense.");
    filter.type = type;
  }
  if (category) {
    if (![...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].includes(category)) throw ApiError.badRequest("Unknown category.");
    filter.category = category;
  }
  const range = dayRange(from, to);
  if (range.start || range.end) {
    filter.date = {};
    if (range.start) filter.date.$gte = range.start;
    if (range.end) filter.date.$lt = range.end;
  }
  if (search && search.trim()) {
    filter.description = { $regex: escapeRegex(search.trim().slice(0, 60)), $options: "i" };
  }
  return { filter, range };
}

/** GET /api/transactions */
async function listTransactions(req, res) {
  const { filter, range } = buildFilter(req.user._id, req.query);
  const sort = SORTS[req.query.sort] || SORTS.newest;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const [items, total] = await Promise.all([
    Transaction.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    Transaction.countDocuments(filter),
  ]);

  // Totals for the whole filtered set (not just this page), unless a text search is active
  const totals = req.query.search
    ? null
    : await totalsByType(req.user._id, { ...range, type: filter.type, category: filter.category });

  res.json({ items, total, page, limit, pages: Math.max(Math.ceil(total / limit), 1), totals });
}

async function findOwnTransaction(req) {
  const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
  // 404 (not 403) so nobody can probe which ids exist for other users
  if (!transaction) throw ApiError.notFound("No transaction found with this id.");
  return transaction;
}

/** GET /api/transactions/:id */
async function getTransaction(req, res) {
  res.json(await findOwnTransaction(req));
}

/** POST /api/transactions */
async function createTransaction(req, res) {
  const transaction = await Transaction.create({ ...pickEditable(req.body), user: req.user._id });
  res.status(201).json(transaction);
}

/** PUT /api/transactions/:id */
async function updateTransaction(req, res) {
  const transaction = await findOwnTransaction(req);
  transaction.set(pickEditable(req.body));
  await transaction.save();
  res.json(transaction);
}

/** DELETE /api/transactions/:id */
async function deleteTransaction(req, res) {
  const transaction = await findOwnTransaction(req);
  await transaction.deleteOne();
  res.json({ message: "Transaction deleted.", id: transaction.id });
}

/** GET /api/transactions/export — CSV of the filtered transactions */
async function exportCsv(req, res) {
  const { filter } = buildFilter(req.user._id, req.query);
  const rows = await Transaction.find(filter).sort(SORTS.newest).limit(10000).lean();

  const escape = (value) => {
    const text = String(value ?? "");
    // Quote fields with commas/quotes/newlines, and neutralise spreadsheet formulas
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };

  const lines = [["Date", "Type", "Category", "Description", "Payment method", "Amount", "Currency"].join(",")];
  for (const t of rows) {
    lines.push(
      [t.date.toISOString().slice(0, 10), t.type, t.category, t.description, t.paymentMethod, t.amount.toFixed(3), req.user.currency]
        .map(escape)
        .join(",")
    );
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="mizan-transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`﻿${lines.join("\n")}`);
}

module.exports = { listTransactions, getTransaction, createTransaction, updateTransaction, deleteTransaction, exportCsv };
