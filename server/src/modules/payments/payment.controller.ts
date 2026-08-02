import { Request, Response } from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const GLOBAL_PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://tftgkvovzntfkymvbwdz.supabase.co"; 
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

// Helper to determine new status based on amount paid vs total
const determineInvoiceStatus = (total: number, amountPaid: number, incomingPayment: number) => {
  const newTotalPaid = amountPaid + incomingPayment;
  if (newTotalPaid >= total) return { status: "PAID", newTotalPaid };
  return { status: "PARTIAL", newTotalPaid };
};

export const handlePaystackWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers["x-paystack-signature"] as string;
    const event = req.body;

    if (!supabaseAdmin) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Cannot process webhook.");
      res.status(500).json({ success: false, message: "Server misconfiguration" });
      return;
    }

    if (event.event === "charge.success") {
      const data = event.data;
      
      // Extract invoice_id from Paystack's custom_fields array
      const customFields = data.metadata?.custom_fields || [];
      const invoiceField = customFields.find((f: any) => f.variable_name === 'invoice_id');
      const invoiceId = invoiceField?.value;

      let secretKeyToUse = GLOBAL_PAYSTACK_SECRET_KEY;
      let invoiceData = null;

      // If it's an invoice payment, lookup the user's specific secret key
      if (invoiceId) {
        const { data: inv } = await supabaseAdmin
          .from("invoices")
          .select("user_id, total, amount_paid")
          .eq("local_id", invoiceId)
          .single();
          
        if (inv) {
          invoiceData = inv;
          const { data: secrets } = await supabaseAdmin
            .from("user_secrets")
            .select("paystack_secret_key")
            .eq("user_id", inv.user_id)
            .single();
            
          if (secrets && secrets.paystack_secret_key) {
            secretKeyToUse = secrets.paystack_secret_key;
          }
        }
      }

      // Validate signature
      const hash = crypto
        .createHmac("sha512", secretKeyToUse)
        .update((req as any).rawBody)
        .digest("hex");

      if (hash !== signature) {
        res.status(401).json({ success: false, message: "Invalid signature" });
        return;
      }

      // If signature is valid and it's an invoice payment, update the invoice
      if (invoiceId && invoiceData) {
        const incomingPayment = Number(data.amount) / 100; // Convert from kobo back to main unit
        const { status, newTotalPaid } = determineInvoiceStatus(
          Number(invoiceData.total), 
          Number(invoiceData.amount_paid || 0), 
          incomingPayment
        );

        const { error } = await supabaseAdmin
          .from("invoices")
          .update({ 
            status: status,
            amount_paid: newTotalPaid
          })
          .eq("local_id", invoiceId);

        if (error) {
          console.error("Error updating invoice in Supabase:", error);
          res.status(500).json({ success: false, message: "Failed to update invoice" });
          return;
        }

        console.log(`Invoice ${invoiceId} updated to ${status} (Paid: ${newTotalPaid})`);
      }
    }

    // Always return 200 OK to Paystack
    res.status(200).send("Webhook received");
  } catch (error) {
    console.error("Paystack Webhook Error:", error);
    res.status(500).send("Webhook error");
  }
};


export const handleFlutterwaveWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers["verif-hash"] as string;
    const event = req.body;

    if (!supabaseAdmin) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Cannot process webhook.");
      res.status(500).json({ success: false, message: "Server misconfiguration" });
      return;
    }

    // Flutterwave event structure for successful charge
    if (event.event === "charge.completed" && event.data.status === "successful") {
      const data = event.data;
      const invoiceId = data.tx_ref; // We pass invoice local_id as tx_ref

      if (invoiceId) {
        const { data: inv } = await supabaseAdmin
          .from("invoices")
          .select("user_id, total, amount_paid")
          .eq("local_id", invoiceId)
          .single();
          
        if (inv) {
          const { data: secrets } = await supabaseAdmin
            .from("user_secrets")
            .select("flutterwave_secret_key")
            .eq("user_id", inv.user_id)
            .single();
            
          // Validate signature using the user's secret hash
          const secretHashToUse = secrets?.flutterwave_secret_key;
          
          if (!secretHashToUse || signature !== secretHashToUse) {
             res.status(401).json({ success: false, message: "Invalid signature" });
             return;
          }

          // Update the invoice status
          const incomingPayment = Number(data.amount);
          const { status, newTotalPaid } = determineInvoiceStatus(
            Number(inv.total), 
            Number(inv.amount_paid || 0), 
            incomingPayment
          );

          const { error } = await supabaseAdmin
            .from("invoices")
            .update({ 
              status: status,
              amount_paid: newTotalPaid
            })
            .eq("local_id", invoiceId);

          if (error) {
            console.error("Error updating invoice in Supabase:", error);
            res.status(500).json({ success: false, message: "Failed to update invoice" });
            return;
          }

          console.log(`Invoice ${invoiceId} updated to ${status} via Flutterwave (Paid: ${newTotalPaid})`);
        }
      }
    }

    res.status(200).send("Webhook received");
  } catch (error) {
    console.error("Flutterwave Webhook Error:", error);
    res.status(500).send("Webhook error");
  }
};
