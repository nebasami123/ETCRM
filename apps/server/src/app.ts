import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { CorsOptions } from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth/auth.js";
import { allowedOrigins, env } from "./config/env.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { salesRoutes } from "./routes/salesRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();

if (env.NODE_ENV === "production") app.set("trust proxy", 1);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true
  } satisfies CorsOptions)
);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.all(
  "/api/auth/*splat",
  (req, res, next) => {
    // Better Auth rate limiter requires the client IP. Express resolves this
    // via 'trust proxy' in production or remoteAddress locally.
    if (!req.headers["x-forwarded-for"] && req.ip) {
      req.headers["x-forwarded-for"] = req.ip;
    }
    next();
  },
  toNodeHandler(auth)
);
app.use(express.json({ limit: "1mb" }));

const appVersion = process.env.APP_VERSION || "0.0.0";
const buildCommit = process.env.BUILD_COMMIT || "local";

app.get("/health", (_req, res) => res.json({ status: "ok", version: appVersion, build: buildCommit }));
app.get("/api/version", (_req, res) => res.json({ version: appVersion, build: buildCommit }));
app.use("/api/admin", adminRoutes);
app.use("/api/sales", salesRoutes);
app.use(errorHandler);
