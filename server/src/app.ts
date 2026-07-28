import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import hpp from "hpp";
import rateLimit from "express-rate-limit";
import { router } from "./index.js";
import { globalErrorHandler } from "./middlewares/error.js";

export const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

// 1. Core Middlewares
app.use(helmet()); // Security headers
app.use(limiter); // Apply rate limit to all requests
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173", // Dynamic CORS
    credentials: true, // ✅ Critical for sending the refresh token cookies!
  }),
); // Allow frontend to communicate with backend
app.use(express.json({
  limit: '10mb',
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
})); // Parse JSON bodies and save raw buffer for webhooks
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(hpp()); // Prevent HTTP Parameter Pollution
app.use(morgan("dev")); // Log requests to console
app.use("/api/v1", router); // Mount the main router for API versioning
// 4. Global Error Handling (Must be the last middleware)
app.use(globalErrorHandler);


export default app;