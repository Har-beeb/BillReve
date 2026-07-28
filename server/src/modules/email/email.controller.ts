import { Request, Response } from 'express';
import { emailService } from '../../services/email.js';
import { DocumentEmail } from '../../templates/DocumentEmail.js';
import { MarketingEmail } from '../../templates/MarketingEmail.js';
import { render } from '@react-email/components';
import React from 'react';

export const sendDocumentController = async (req: Request, res: Response): Promise<any> => {
  try {
    const { to, subject, documentData, attachments } = req.body;



    // Process attachments (convert data URI base64 to pure base64 Buffer)
    const processedAttachments = attachments?.map((att: any) => {
      let content = att.content;
      if (typeof content === 'string' && content.startsWith('data:')) {
        content = content.split(',')[1];
      }
      return {
        filename: att.filename,
        content: Buffer.from(content, 'base64'),
      };
    });

    // Render the React Email template to an HTML string
    // In production React 18, we can use the renderToString method from react-email
    const html = await render(
      React.createElement(DocumentEmail, {
        type: documentData.type || 'INVOICE',
        documentNumber: documentData.documentNumber,
        clientName: documentData.clientName,
        amount: documentData.amount,
        dueDate: documentData.dueDate,
        businessName: documentData.businessName,
        paymentLink: documentData.paymentLink,
        customMessage: documentData.customMessage,
      })
    );

    const result = await emailService.sendTransactionalEmail({
      to,
      subject,
      html: html,
      attachments: processedAttachments,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Send document email failed:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMarketingController = async (req: Request, res: Response): Promise<any> => {
  try {
    const { to, subject, title, previewText, content, ctaText, ctaLink } = req.body;



    const html = await render(
      React.createElement(MarketingEmail, {
        title,
        previewText,
        content,
        ctaText,
        ctaLink,
      })
    );

    const result = await emailService.sendMarketingEmail({
      to,
      subject,
      html: html,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Send marketing email failed:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
