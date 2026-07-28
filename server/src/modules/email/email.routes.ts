import { Router } from 'express';
import { sendDocumentController, sendMarketingController } from './email.controller.js';
import { validateRequest } from '../../middlewares/validate.js';
import { z } from 'zod';

export const emailRouter = Router();

const sendDocumentSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  documentData: z.object({
    type: z.enum(['QUOTE', 'INVOICE']).optional(),
    documentNumber: z.string().optional(),
    clientName: z.string().optional(),
    amount: z.number().optional(),
    dueDate: z.string().optional(),
    businessName: z.string().optional(),
    paymentLink: z.string().optional(),
  }),
  attachments: z.array(z.any()).optional()
});

const sendMarketingSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1),
  title: z.string().optional(),
  previewText: z.string().optional(),
  content: z.string().min(1),
  ctaText: z.string().optional(),
  ctaLink: z.string().url().optional()
});

emailRouter.post('/send-document', validateRequest(sendDocumentSchema), sendDocumentController);
emailRouter.post('/send-marketing', validateRequest(sendMarketingSchema), sendMarketingController);
