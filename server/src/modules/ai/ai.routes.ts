import { Router } from "express";
import rateLimit from "express-rate-limit";
import { generateQuote, enhanceText, draftEmail, chatWithRevenue } from "./ai.controller.js";

export const aiRouter = Router();

const aiLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 100, // Limit each IP to 100 requests per window (here, per day)
  message: { error: "You have exceeded your 100 AI requests limit for today. Please try again tomorrow." },
  standardHeaders: true,
  legacyHeaders: false,
});

aiRouter.use(aiLimiter);

// Define route for generating quotes
aiRouter.post("/generate-quote", generateQuote);
aiRouter.post("/enhance-text", enhanceText);
aiRouter.post("/draft-email", draftEmail);
aiRouter.post("/insights", chatWithRevenue);
