const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");
const Budget = require("../src/models/Budget");
const db = require("./helpers/db");

process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-jwt-signing";

const alice = { name: "Alice Martin", email: "alice@example.com", password: "Password1", currency: "EUR" };
const bob = { name: "Bob Ayari", email: "bob@example.com", password: "Password2" };

/** Registers a user and returns an agent that keeps the auth cookie */
async function signedInAgent(user = alice) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/register").send(user);
  expect(res.status).toBe(201);
  return agent;
}

beforeAll(db.connect);
beforeEach(async () => {
  await db.clear();
  await Promise.all([User.syncIndexes(), Budget.syncIndexes()]);
});
afterAll(db.close);

describe("Authentication", () => {
  it("registers a user, sets an httpOnly cookie and never returns the password", async () => {
    const res = await request(app).post("/api/auth/register").send(alice);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: "Alice Martin", email: "alice@example.com", currency: "EUR" });
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.token).toEqual(expect.any(String));
    const cookie = res.headers["set-cookie"][0];
    expect(cookie).toMatch(/mizan_token=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it("stores a bcrypt hash, not the plain password", async () => {
    await request(app).post("/api/auth/register").send(alice);
    const stored = await User.findOne({ email: alice.email }).select("+password");
    expect(stored.password).not.toBe(alice.password);
    expect(stored.password).toMatch(/^\$2[aby]\$/);
  });

  it("rejects weak passwords and invalid emails", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "A", email: "nope", password: "short" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(["email", "name", "password"]);

    const noDigit = await request(app).post("/api/auth/register").send({ ...alice, password: "OnlyLetters" });
    expect(noDigit.status).toBe(400);
    expect(noDigit.body.errors.password).toMatch(/letter and one number/);
  });

  it("refuses a second account with the same email", async () => {
    await request(app).post("/api/auth/register").send(alice);
    const res = await request(app).post("/api/auth/register").send({ ...alice, email: "ALICE@example.com" });
    expect(res.status).toBe(409);
    expect(res.body.errors.email).toBeDefined();
  });

  it("signs in with the right password and refuses the wrong one", async () => {
    await request(app).post("/api/auth/register").send(alice);
    const good = await request(app).post("/api/auth/login").send({ email: "Alice@Example.com", password: alice.password });
    expect(good.status).toBe(200);
    expect(good.body.user.email).toBe(alice.email);

    const bad = await request(app).post("/api/auth/login").send({ email: alice.email, password: "Wrong1234" });
    expect(bad.status).toBe(401);
    const unknown = await request(app).post("/api/auth/login").send({ email: "who@example.com", password: "Wrong1234" });
    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toBe(bad.body.message);
  });

  it("protects private routes and accepts cookie or Bearer token", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    expect((await request(app).get("/api/transactions")).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Authorization", "Bearer not.a.token")).status).toBe(401);

    const reg = await request(app).post("/api/auth/register").send(alice);
    const viaBearer = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${reg.body.token}`);
    expect(viaBearer.status).toBe(200);

    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: alice.email, password: alice.password });
    expect((await agent.get("/api/auth/me")).body.user.name).toBe("Alice Martin");
  });

  it("answers the session check for visitors and signed-in users", async () => {
    expect((await request(app).get("/api/auth/session")).body).toEqual({ user: null });
    const agent = await signedInAgent();
    expect((await agent.get("/api/auth/session")).body.user.email).toBe(alice.email);
  });

  it("signs out by clearing the cookie", async () => {
    const agent = await signedInAgent();
    const res = await agent.post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });

  it("updates the profile and changes the password", async () => {
    const agent = await signedInAgent();
    const profile = await agent.patch("/api/auth/me").send({ name: "Alice M.", currency: "USD" });
    expect(profile.body.user).toMatchObject({ name: "Alice M.", currency: "USD" });

    const wrong = await agent.patch("/api/auth/password").send({ currentPassword: "nope", newPassword: "NewPass99" });
    expect(wrong.status).toBe(400);
    const weak = await agent.patch("/api/auth/password").send({ currentPassword: alice.password, newPassword: "short" });
    expect(weak.status).toBe(400);
    expect(weak.body.errors.newPassword).toBeDefined();
    const ok = await agent.patch("/api/auth/password").send({ currentPassword: alice.password, newPassword: "NewPass99" });
    expect(ok.status).toBe(200);
    const login = await request(app).post("/api/auth/login").send({ email: alice.email, password: "NewPass99" });
    expect(login.status).toBe(200);
  });
});

describe("Transactions", () => {
  it("creates, reads, updates and deletes a transaction", async () => {
    const agent = await signedInAgent();
    const created = await agent
      .post("/api/transactions")
      .send({ type: "expense", amount: 42.5, category: "Groceries", description: "Market", date: "2026-11-03", paymentMethod: "Cash" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ type: "expense", amount: 42.5, category: "Groceries", paymentMethod: "Cash" });
    expect(created.body.date).toBe("2026-11-03T00:00:00.000Z");

    const id = created.body.id;
    expect((await agent.get(`/api/transactions/${id}`)).body.description).toBe("Market");

    const updated = await agent.put(`/api/transactions/${id}`).send({ amount: 50, description: "Market and bakery" });
    expect(updated.body).toMatchObject({ amount: 50, description: "Market and bakery" });

    expect((await agent.delete(`/api/transactions/${id}`)).status).toBe(200);
    expect((await agent.get(`/api/transactions/${id}`)).status).toBe(404);
  });

  it("validates amount, type and that the category matches the type", async () => {
    const agent = await signedInAgent();
    const res = await agent.post("/api/transactions").send({ type: "expense", amount: -5, category: "Salary", date: "2026-11-03" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty("amount");
    expect(res.body.errors.category).toMatch(/matches the transaction type/);

    const badType = await agent.post("/api/transactions").send({ type: "gift", amount: 5, category: "Other", date: "2026-11-03" });
    expect(badType.status).toBe(400);
    expect(badType.body.errors).toHaveProperty("type");
  });

  it("keeps each user's data private", async () => {
    const aliceAgent = await signedInAgent(alice);
    const bobAgent = await signedInAgent(bob);
    const t = await aliceAgent.post("/api/transactions").send({ type: "income", amount: 1000, category: "Salary", date: "2026-11-01" });

    expect((await bobAgent.get(`/api/transactions/${t.body.id}`)).status).toBe(404);
    expect((await bobAgent.put(`/api/transactions/${t.body.id}`).send({ amount: 1 })).status).toBe(404);
    expect((await bobAgent.delete(`/api/transactions/${t.body.id}`)).status).toBe(404);
    expect((await bobAgent.get("/api/transactions")).body.total).toBe(0);
    expect((await aliceAgent.get("/api/transactions")).body.total).toBe(1);
  });

  it("filters, sorts, paginates and totals the list", async () => {
    const agent = await signedInAgent();
    const rows = [
      { type: "income", amount: 1000, category: "Salary", date: "2026-10-01", description: "October salary" },
      { type: "expense", amount: 300, category: "Housing", date: "2026-10-02", description: "Rent" },
      { type: "expense", amount: 60, category: "Groceries", date: "2026-10-15", description: "Market" },
      { type: "income", amount: 1000, category: "Salary", date: "2026-11-01", description: "November salary" },
      { type: "expense", amount: 80, category: "Groceries", date: "2026-11-04", description: "Supermarket" },
    ];
    for (const row of rows) await agent.post("/api/transactions").send(row);

    const october = await agent.get("/api/transactions").query({ from: "2026-10-01", to: "2026-10-31" });
    expect(october.body.total).toBe(3);
    expect(october.body.totals).toEqual({ income: 1000, expense: 360, net: 640 });

    const groceries = await agent.get("/api/transactions").query({ category: "Groceries", sort: "amount-desc" });
    expect(groceries.body.items.map((t) => t.amount)).toEqual([80, 60]);

    const search = await agent.get("/api/transactions").query({ search: "salary" });
    expect(search.body.total).toBe(2);

    const page2 = await agent.get("/api/transactions").query({ limit: 2, page: 2 });
    expect(page2.body).toMatchObject({ total: 5, pages: 3, page: 2 });
    expect(page2.body.items).toHaveLength(2);

    const badRange = await agent.get("/api/transactions").query({ from: "2026-11-10", to: "2026-11-01" });
    expect(badRange.status).toBe(400);
  });

  it("exports the filtered transactions as CSV", async () => {
    const agent = await signedInAgent();
    await agent.post("/api/transactions").send({ type: "expense", amount: 12.5, category: "Eating out", date: "2026-11-02", description: "Lunch, with friends" });
    await agent.post("/api/transactions").send({ type: "expense", amount: 3, category: "Other", date: "2026-11-02", description: "=HYPERLINK(\"x\")" });
    const res = await agent.get("/api/transactions/export");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain("Date,Type,Category,Description,Payment method,Amount,Currency");
    expect(res.text).toContain('"Lunch, with friends"');
    expect(res.text).toContain("'=HYPERLINK");
    expect(res.text).toContain("12.500,EUR");
  });
});

describe("Reports and budgets", () => {
  let agent;

  beforeEach(async () => {
    agent = await signedInAgent();
    const rows = [
      { type: "income", amount: 1200, category: "Salary", date: "2026-09-01" },
      { type: "expense", amount: 400, category: "Housing", date: "2026-09-02" },
      { type: "income", amount: 1200, category: "Salary", date: "2026-10-01" },
      { type: "income", amount: 300, category: "Freelance", date: "2026-10-20" },
      { type: "expense", amount: 400, category: "Housing", date: "2026-10-02" },
      { type: "expense", amount: 150, category: "Groceries", date: "2026-10-10" },
      { type: "expense", amount: 50, category: "Groceries", date: "2026-10-25" },
      { type: "expense", amount: 100, category: "Eating out", date: "2026-10-28" },
    ];
    for (const row of rows) await agent.post("/api/transactions").send(row);
    await agent.put("/api/budgets/Groceries").send({ monthlyLimit: 250 });
  });

  it("summarises one month for the dashboard", async () => {
    const res = await agent.get("/api/reports/summary").query({ month: "2026-10" });
    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ income: 1500, expense: 700, net: 800, savingsRate: 53.3 });
    expect(res.body.previousTotals).toEqual({ income: 1200, expense: 400, net: 800 });
    expect(res.body.balance).toBe(1600);
    expect(res.body.expenseByCategory[0]).toEqual({ category: "Housing", total: 400, share: 57.1 });
    expect(res.body.budgets).toEqual([{ category: "Groceries", limit: 250, spent: 200, used: 80 }]);
    expect(res.body.cumulativeSpending).toHaveLength(31);
    expect(res.body.cumulativeSpending[30].total).toBe(700);
    expect(res.body.cumulativeSpending[9].total).toBe(550);
  });

  it("returns a month-by-month trend", async () => {
    const res = await agent.get("/api/reports/trend").query({ months: 3, end: "2026-11" });
    expect(res.body.months).toEqual([
      { month: "2026-09", income: 1200, expense: 400, net: 800 },
      { month: "2026-10", income: 1500, expense: 700, net: 800 },
      { month: "2026-11", income: 0, expense: 0, net: 0 },
    ]);
  });

  it("builds a report for any date range", async () => {
    const res = await agent.get("/api/reports/range").query({ from: "2026-09-01", to: "2026-10-31" });
    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({ income: 2700, expense: 1100, net: 1600 });
    expect(res.body.monthly.map((m) => m.month)).toEqual(["2026-09", "2026-10"]);
    expect(res.body.incomeByCategory).toEqual([
      { category: "Salary", total: 2400, share: 88.9 },
      { category: "Freelance", total: 300, share: 11.1 },
    ]);
    expect(res.body.topExpenses[0].amount).toBe(400);
    expect(res.body.averageDailySpending).toBe(18.033);
  });

  it("lists, updates and removes budgets", async () => {
    const list = await agent.get("/api/budgets").query({ month: "2026-10" });
    const groceries = list.body.categories.find((c) => c.category === "Groceries");
    expect(groceries).toEqual({ category: "Groceries", limit: 250, spent: 200 });
    expect(list.body.categories.find((c) => c.category === "Housing")).toEqual({ category: "Housing", limit: null, spent: 400 });

    const updated = await agent.put("/api/budgets/Groceries").send({ monthlyLimit: 300 });
    expect(updated.body.monthlyLimit).toBe(300);
    expect(await Budget.countDocuments()).toBe(1);

    expect((await agent.put("/api/budgets/Salary").send({ monthlyLimit: 10 })).status).toBe(400);
    expect((await agent.put("/api/budgets/Housing").send({ monthlyLimit: 0 })).status).toBe(400);

    expect((await agent.delete("/api/budgets/Groceries")).status).toBe(200);
    expect((await agent.delete("/api/budgets/Groceries")).status).toBe(404);
  });

  it("deletes the account together with all its data", async () => {
    const res = await agent.delete("/api/auth/me");
    expect(res.status).toBe(200);
    expect(await User.countDocuments()).toBe(0);
    expect(await Budget.countDocuments()).toBe(0);
  });
});
