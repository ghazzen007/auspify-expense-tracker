const ApiError = require("./ApiError");

/**
 * All dates are handled as calendar days in UTC: "2026-11-12" is stored as
 * 2026-11-12T00:00:00Z. That keeps month boundaries identical for every user.
 */

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function currentMonthKey(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-11" -> { start: 2026-11-01, end: 2026-12-01 } (end is exclusive) */
function monthRange(key = currentMonthKey()) {
  const match = MONTH_RE.exec(key);
  if (!match) throw ApiError.badRequest("Month must look like 2026-11.");
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return { start: new Date(Date.UTC(year, month, 1)), end: new Date(Date.UTC(year, month + 1, 1)) };
}

function shiftMonth(key, delta) {
  const { start } = monthRange(key);
  return currentMonthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + delta, 1)));
}

function parseDay(value, field) {
  if (!DAY_RE.test(value || "")) throw ApiError.badRequest(`${field} must be a date like 2026-11-12.`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest(`${field} is not a valid date.`);
  return date;
}

/** Inclusive "from" and "to" days -> a [start, end) range */
function dayRange(from, to) {
  const range = {};
  if (from) range.start = parseDay(from, "from");
  if (to) {
    const end = parseDay(to, "to");
    range.end = new Date(end.getTime() + 24 * 3600 * 1000);
  }
  if (range.start && range.end && range.start >= range.end) {
    throw ApiError.badRequest("The start date must be on or before the end date.");
  }
  return range;
}

/** Month keys between two dates, oldest first: ["2026-09", "2026-10", ...] */
function monthsBetween(start, endExclusive) {
  const keys = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor < endExclusive) {
    keys.push(currentMonthKey(cursor));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return keys;
}

module.exports = { currentMonthKey, monthRange, shiftMonth, dayRange, parseDay, monthsBetween };
