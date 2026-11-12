require("dotenv").config({ quiet: true });

const app = require("./app");
const { connectDB } = require("./config/db");

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET must be set in server/.env (at least 32 random characters).");
    }
    await connectDB();
    console.log("Connected to MongoDB");
    app.listen(PORT, () => console.log(`Mizan API running on http://localhost:${PORT}`));
  } catch (error) {
    console.error("Could not start the server:", error.message);
    process.exit(1);
  }
}

start();
