import { Resend } from 'resend';
import dotenv from 'dotenv';
import dns from 'dns';

// Fix Node.js 18+ native fetch DNS resolution issues with api.resend.com
dns.setDefaultResultOrder('ipv4first');

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

const TRANSACTIONAL_SENDER = process.env.EMAIL_FROM || 'BillReve <hello@billreve.app>';
const MARKETING_SENDER = process.env.EMAIL_FROM || 'BillReve Updates <hello@billreve.app>';

async function sendWithRetry(payload: any, retries = 2): Promise<any> {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await resend.emails.send(payload);
      
      // If successful, or if it's a real API validation error (not a fetch network bug), return it immediately
      if (!response.error || !response.error.message?.includes('Unable to fetch data')) {
        return response;
      }
      
      // Force it to catch block for manual retry logic
      throw new Error(response.error.message);
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      if (!errorMessage.includes('Unable to fetch data') && !errorMessage.includes('fetch')) {
        // If it's a different error, return it immediately so the caller can handle it
        return { error: err };
      }
      
      attempt++;
      if (attempt <= retries) {
        console.warn(`Resend fetch failed (${errorMessage}), retrying attempt ${attempt}...`);
        await new Promise(res => setTimeout(res, 1000));
      } else {
        return { error: err }; // Return the error if we are out of retries
      }
    }
  }
}

export const emailService = {
  /**
   * Sends a transactional email (e.g. Quotes, Invoices, Receipts, Password Resets)
   */
  async sendTransactionalEmail(options: {
    to: string;
    subject: string;
    react?: React.ReactElement;
    html?: string;
    attachments?: { filename: string; content: string | Buffer }[];
  }) {
    try {
      const { data, error } = await sendWithRetry({
        from: TRANSACTIONAL_SENDER,
        to: [options.to],
        subject: options.subject,
        ...(options.html ? { html: options.html } : { react: options.react }),
        attachments: options.attachments,
        tags: [{ name: 'category', value: 'transactional' }],
      });

      if (error) {
        console.error('Failed to send transactional email:', error);
        throw error;
      }
      return { success: true, data };
    } catch (error) {
      console.error('Email Service Error (Transactional):', error);
      throw error;
    }
  },

  /**
   * Sends a marketing/advertisement email (e.g. Onboarding, Ads, Pro features)
   */
  async sendMarketingEmail(options: {
    to: string;
    subject: string;
    react?: React.ReactElement;
    html?: string;
  }) {
    try {
      const { data, error } = await sendWithRetry({
        from: MARKETING_SENDER,
        to: [options.to],
        subject: options.subject,
        ...(options.html ? { html: options.html } : { react: options.react }),
        tags: [{ name: 'category', value: 'marketing' }],
        // In a full production setup with Resend Audiences, 
        // you would use resend.contacts.create() instead or include list-unsubscribe headers
      });

      if (error) {
        console.error('Failed to send marketing email:', error);
        throw error;
      }
      return { success: true, data };
    } catch (error) {
      console.error('Email Service Error (Marketing):', error);
      throw error;
    }
  },
};
