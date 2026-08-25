import express from "express";
import rateLimit from "express-rate-limit";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.config.js";
import {
  authRoutes,
  userRoutes,
  auctionRoutes,
  contactRoutes,
  adminRoutes,
  cloudinaryRoutes,
} from "./routes/index.js";
import { connectDB } from "./config/db.config.js";
import cron from "node-cron";
import { cleanupUnusedUploads } from "./jobs/cleanupUploads.js";
import { closeAuctions } from "./jobs/closeAuctions.js";

export const app = express();

app.use(
  cors({
    origin: env.origin,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(compression());
app.use(express.json());

// DB connection for Vercel serveless deployment
if (process.env.VERCEL) {
  app.use(async (req, res, next) => {
    await connectDB();
    next();
  });
}

let isRunning = false;

// Daily cleanup cron job
cron.schedule("0 0 * * *", async () => { // Runs at midnight every day
  if (isRunning) return;

  isRunning = true;

  try {
    await cleanupUnusedUploads();
  } catch (err) {
    console.error(err);
  } finally {
    isRunning = false;
  }
});

let isClosingAuctions = false;

// Every 5 minutes, close expired auctions
cron.schedule("*/5 * * * *", async () => {
  if (isClosingAuctions) return;

  isClosingAuctions = true;
  try {
    await closeAuctions();
  } catch (err) {
    console.error(err);
  } finally {
    isClosingAuctions = false;
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per IP per window
  standardHeaders: true,     // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again after 15 minutes." },
});

app.get("/health", (req, res) => res.status(200).json({ status: "OK", timestamp: new Date() }));
app.use("/api/auth", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/auction", auctionRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upload", cloudinaryRoutes);

export default app; // Exporting default app for serverless deployment
