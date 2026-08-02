import { Router } from "express";
import { handlePaystackWebhook, handleFlutterwaveWebhook } from "./payment.controller.js";

export const paymentRouter = Router();

// Paystack webhook endpoint
paymentRouter.post("/webhook/paystack", handlePaystackWebhook);
paymentRouter.post("/webhook", handlePaystackWebhook); // Keep old path for backward compatibility

// Flutterwave webhook endpoint
paymentRouter.post("/webhook/flutterwave", handleFlutterwaveWebhook);
