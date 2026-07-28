import { Router } from "express";
import { handlePaystackWebhook } from "./payment.controller.js";

export const paymentRouter = Router();

// Paystack webhook endpoint
paymentRouter.post("/webhook", handlePaystackWebhook);
