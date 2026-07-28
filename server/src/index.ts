import { Router } from "express";
import { paymentRouter } from "./modules/payments/payment.routes.js";
import { emailRouter } from "./modules/email/email.routes.js";
import { aiRouter } from "./modules/ai/ai.routes.js";

export const router = Router();

// Health Check Route
router.get("/health", (_req, res) => {
  return res
    .status(200)
    .json({ success: true, message: "BillFlow API is running optimally." });
});

// Feature Routes
router.use("/payments", paymentRouter);
router.use("/email", emailRouter);
router.use("/ai", aiRouter);
