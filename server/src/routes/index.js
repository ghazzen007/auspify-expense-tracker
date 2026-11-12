const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const auth = require("../controllers/authController");
const transactions = require("../controllers/transactionController");
const reports = require("../controllers/reportController");
const budgets = require("../controllers/budgetController");
const { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, CURRENCIES } = require("../config/categories");

const router = Router();

// Slow down password guessing: 20 sign-in attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many attempts. Wait a few minutes and try again." },
  skip: () => process.env.NODE_ENV === "test",
});

router.get("/meta", (req, res) => {
  res.json({
    expenseCategories: EXPENSE_CATEGORIES,
    incomeCategories: INCOME_CATEGORIES,
    paymentMethods: PAYMENT_METHODS,
    currencies: CURRENCIES,
  });
});

// Authentication
router.post("/auth/register", authLimiter, auth.register);
router.post("/auth/login", authLimiter, auth.login);
router.post("/auth/logout", auth.logout);
router.get("/auth/me", requireAuth, auth.me);
// Same as /auth/me but answers { user: null } for visitors instead of 401
router.get("/auth/session", optionalAuth, auth.me);
router.patch("/auth/me", requireAuth, auth.updateMe);
router.delete("/auth/me", requireAuth, auth.deleteMe);
router.patch("/auth/password", requireAuth, auth.changePassword);

// Transactions (every route below needs a signed-in user)
router.get("/transactions/export", requireAuth, transactions.exportCsv);
router.get("/transactions", requireAuth, transactions.listTransactions);
router.post("/transactions", requireAuth, transactions.createTransaction);
router.get("/transactions/:id", requireAuth, transactions.getTransaction);
router.put("/transactions/:id", requireAuth, transactions.updateTransaction);
router.delete("/transactions/:id", requireAuth, transactions.deleteTransaction);

// Reports
router.get("/reports/summary", requireAuth, reports.monthSummary);
router.get("/reports/trend", requireAuth, reports.trend);
router.get("/reports/range", requireAuth, reports.rangeReport);

// Budgets
router.get("/budgets", requireAuth, budgets.listBudgets);
router.put("/budgets/:category", requireAuth, budgets.setBudget);
router.delete("/budgets/:category", requireAuth, budgets.removeBudget);

module.exports = router;
