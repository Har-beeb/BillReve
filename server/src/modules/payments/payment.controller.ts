import { Request, Response } from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://tftgkvovzntfkymvbwdz.supabase.co"; // fallback if not in env
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

export const handlePaystackWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers["x-paystack-signature"] as string;
    
    // Validate signature
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update((req as any).rawBody)
      .digest("hex");

    if (hash !== signature) {
      res.status(401).json({ success: false, message: "Invalid signature" });
      return;
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const data = event.data;
      
      // Extract invoice_id from Paystack's custom_fields array
      const customFields = data.metadata?.custom_fields || [];
      const invoiceField = customFields.find((f: any) => f.variable_name === 'invoice_id');
      const invoiceId = invoiceField?.value;

      if (invoiceId) {
        if (!supabaseAdmin) {
          console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Cannot update invoice.");
          res.status(500).json({ success: false, message: "Server misconfiguration" });
          return;
        }

        // Update the invoice status to PAID in Supabase using snake_case
        const { error } = await supabaseAdmin
          .from("invoices")
          .update({ 
            status: "PAID",
            amount_paid: Number(data.amount) / 100 // Convert from kobo back to main unit
          })
          .eq("local_id", invoiceId);

        if (error) {
          console.error("Error updating invoice in Supabase:", error);
          res.status(500).json({ success: false, message: "Failed to update invoice" });
          return;
        }

        console.log(`Invoice ${invoiceId} marked as PAID`);
      }
    }

    // Always return 200 OK to Paystack
    res.status(200).send("Webhook received");
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).send("Webhook error");
  }
};
