import { Router } from "express";
import { generateQuote, enhanceText, draftEmail, chatWithRevenue } from "./ai.controller.js";

export const aiRouter = Router();

// Define route for generating quotes
aiRouter.post("/generate-quote", generateQuote);
aiRouter.post("/enhance-text", enhanceText);
aiRouter.post("/draft-email", draftEmail);
aiRouter.post("/insights", chatWithRevenue);
