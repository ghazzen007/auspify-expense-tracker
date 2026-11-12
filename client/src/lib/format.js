/* Formatting helpers for money, dates and months */

const formatters = new Map();

export function money(amount, currency = "TND", { sign = false, compact = false } = {}) {
  const key = `${currency}-${compact}`;
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : currency === "TND" ? 3 : 2,
        minimumFractionDigits: compact ? 0 : undefined,
      })
    );
  }
  const text = formatters.get(key).format(Math.abs(amount || 0));
  if (!sign) return amount < 0 ? `−${text}` : text;
  return amount < 0 ? `−${text}` : `+${text}`;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const currentMonth = () => todayISO().slice(0, 7);

export function shiftMonth(key, delta) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function monthLabel(key, style = "long") {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", { month: style, year: "numeric", timeZone: "UTC" });
}

export const shortMonth = (key) => {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
};

export function dayLabel(iso) {
  const date = new Date(iso);
  const today = todayISO();
  const day = date.toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export const shortDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function lastDayOfMonth(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

// One colour per category, used consistently in charts, dots and legends
const CATEGORY_COLORS = {
  Housing: "#4b5bd7",
  Groceries: "#178a62",
  Transport: "#d68a1c",
  "Eating out": "#d9482b",
  "Bills & utilities": "#6c4bb4",
  Health: "#cc3d78",
  Education: "#2a7fb8",
  Shopping: "#b06a2b",
  Entertainment: "#8a5cd6",
  Travel: "#1b9aa0",
  "Gifts & donations": "#c9a227",
  Other: "#7a8094",
  Salary: "#178a62",
  Freelance: "#2a7fb8",
  Scholarship: "#6c4bb4",
  Business: "#4b5bd7",
  Gifts: "#c9a227",
  Refunds: "#1b9aa0",
  "Other income": "#7a8094",
};

export const categoryColor = (category) => CATEGORY_COLORS[category] || "#7a8094";
