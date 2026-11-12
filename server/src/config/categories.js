/**
 * Fixed category lists. Keeping them on the server means reports always
 * group money the same way, and the client fetches them from /api/meta.
 */
const EXPENSE_CATEGORIES = [
  "Housing",
  "Groceries",
  "Transport",
  "Eating out",
  "Bills & utilities",
  "Health",
  "Education",
  "Shopping",
  "Entertainment",
  "Travel",
  "Gifts & donations",
  "Other",
];

const INCOME_CATEGORIES = ["Salary", "Freelance", "Scholarship", "Business", "Gifts", "Refunds", "Other income"];

const PAYMENT_METHODS = ["Cash", "Card", "Bank transfer", "Mobile wallet"];

const CURRENCIES = ["TND", "USD", "EUR", "GBP", "INR", "MAD"];

module.exports = { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, CURRENCIES };
