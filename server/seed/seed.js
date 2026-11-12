/**
 * Creates a demo account with twelve months of realistic transactions and budgets.
 * Usage: npm run seed
 * Sign in with demo@mizan.app / Demo1234
 */
require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");
const { connectDB } = require("../src/config/db");
const User = require("../src/models/User");
const Transaction = require("../src/models/Transaction");
const Budget = require("../src/models/Budget");

const DEMO = { name: "Ghassen Jdidi", email: "demo@mizan.app", password: "Demo1234", currency: "TND" };

// Deterministic random numbers so the demo looks the same on every machine
let state = 7;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
const between = (min, max) => Math.round((min + rand() * (max - min)) * 1000) / 1000;
const pick = (list) => list[Math.floor(rand() * list.length)];

const day = (year, month, date) => new Date(Date.UTC(year, month, date));

function monthOfTransactions(year, month, lastDay) {
  const items = [];
  const add = (type, category, amount, date, description, paymentMethod = "Card") => {
    if (date <= lastDay) items.push({ type, category, amount, date: day(year, month, date), description, paymentMethod });
  };

  // Income
  add("income", "Salary", 1450, 1, "Monthly salary", "Bank transfer");
  if (rand() > 0.35) add("income", "Freelance", between(180, 650), 8 + Math.floor(rand() * 15), pick(["Landing page for a café", "Logo and website fixes", "n8n automation for a shop", "Dashboard for a client"]), "Bank transfer");
  if (month % 3 === 0) add("income", "Scholarship", 250, 5, "Merit scholarship instalment", "Bank transfer");

  // Fixed costs
  add("expense", "Housing", 520, 2, "Rent, Ariana apartment", "Bank transfer");
  add("expense", "Bills & utilities", between(55, 95), 6, "Electricity and water (STEG, SONEDE)", "Mobile wallet");
  add("expense", "Bills & utilities", 45, 10, "Home internet", "Card");
  add("expense", "Education", 35, 12, "Online course subscription", "Card");

  // Everyday spending
  for (let i = 0; i < 6; i += 1) add("expense", "Groceries", between(28, 85), 3 + i * 5, pick(["Carrefour market", "Monoprix", "Weekly market", "Aziza"]), pick(["Card", "Cash"]));
  for (let i = 0; i < 8; i += 1) add("expense", "Transport", between(4, 22), 2 + i * 3, pick(["Metro card top-up", "Taxi", "Bolt ride", "Fuel"]), pick(["Cash", "Mobile wallet"]));
  for (let i = 0; i < 5; i += 1) add("expense", "Eating out", between(9, 48), 4 + i * 5, pick(["Lunch with classmates", "Coffee and croissant", "Pizza night", "Brunch in La Marsa"]), pick(["Cash", "Card"]));
  add("expense", "Entertainment", between(15, 40), 14, pick(["Cinema", "Concert ticket", "Football match", "Streaming subscription"]));
  if (rand() > 0.4) add("expense", "Shopping", between(40, 160), 18, pick(["New sneakers", "Headphones", "Clothes", "Phone case and charger"]));
  if (rand() > 0.6) add("expense", "Health", between(20, 70), 21, pick(["Pharmacy", "Dentist check-up", "Gym membership"]));
  if (rand() > 0.75) add("expense", "Gifts & donations", between(30, 90), 25, pick(["Birthday gift", "Charity donation"]));
  if (month === 7) add("expense", "Travel", 380, 9, "Weekend in Djerba", "Card");

  return items;
}

async function seed() {
  await connectDB();

  const existing = await User.findOne({ email: DEMO.email });
  if (existing) {
    await Promise.all([Transaction.deleteMany({ user: existing._id }), Budget.deleteMany({ user: existing._id })]);
    await existing.deleteOne();
  }

  const user = await User.create(DEMO);

  // The last 12 months, up to today
  const today = new Date();
  const transactions = [];
  for (let back = 11; back >= 0; back -= 1) {
    const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
    const year = first.getUTCFullYear();
    const month = first.getUTCMonth();
    const lastDay = back === 0 ? today.getUTCDate() : 31;
    transactions.push(...monthOfTransactions(year, month, lastDay).filter((t) => t.date.getUTCMonth() === month));
  }
  await Transaction.insertMany(transactions.map((t) => ({ ...t, user: user._id })));

  await Budget.insertMany(
    [
      ["Groceries", 350],
      ["Eating out", 150],
      ["Transport", 120],
      ["Shopping", 150],
      ["Entertainment", 60],
    ].map(([category, monthlyLimit]) => ({ user: user._id, category, monthlyLimit }))
  );

  console.log(`Demo account ready: ${DEMO.email} / ${DEMO.password} (${transactions.length} transactions).`);
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error("Seeding failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
