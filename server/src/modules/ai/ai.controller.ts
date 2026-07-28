import { Request, Response } from "express";
import { z } from "zod";
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../../config/env.js";

// Initialize Gemini SDK
// Note: We'll initialize lazily in the function in case the API key is not present initially
let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured in the environment.");
    }
    ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return ai;
};

// Request Validation Schema
const GenerateQuoteSchema = z.object({
  text: z.string().optional(),
  documentType: z.enum(['QUOTE', 'INVOICE']).optional().default('QUOTE'),
  documents: z.array(z.object({
    mimeType: z.string(),
    data: z.string() // base64 string
  })).optional()
}).refine(data => data.text || (data.documents && data.documents.length > 0), {
  message: "Either text or at least one document must be provided."
});

export const generateQuote = async (req: Request, res: Response): Promise<any> => {
  try {
    const validatedData = GenerateQuoteSchema.parse(req.body);
    const aiClient = getAI();

    const docTypeName = validatedData.documentType === 'INVOICE' ? 'Invoice' : 'Quote';

    const prompt = `You are a professional invoicing assistant. 
Your task is to parse the provided text or document(s) into a structured ${docTypeName}.
Extract all line items, their descriptions, quantities, and unit prices.
If a quantity is not specified, assume 1.
If the notes mention a general description, use that for the ${docTypeName.toLowerCase()} description.
Ensure all prices are represented as numbers (do not include currency symbols).`;

    // Construct the contents payload for Gemini
    const contents: any[] = [];
    
    // The prompt acts as the first part
    contents.push({ text: prompt });

    // Add any provided text
    if (validatedData.text) {
      contents.push({ text: `Notes from user: ${validatedData.text}` });
    }

    // Add any provided documents/images
    if (validatedData.documents && validatedData.documents.length > 0) {
      for (const doc of validatedData.documents) {
        // Strip the data:image/png;base64, prefix if it exists
        const base64Data = doc.data.includes('base64,') ? doc.data.split('base64,')[1] : doc.data;
        
        contents.push({
          inlineData: {
            mimeType: doc.mimeType,
            data: base64Data
          }
        });
      }
    }

    // Call Gemini 3.5 Flash Lite
    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: {
              type: Type.STRING,
              description: `A brief description or summary of the entire ${docTypeName.toLowerCase()} based on the context.`
            },
            items: {
              type: Type.ARRAY,
              description: "The list of items or services to be quoted.",
              items: {
                type: Type.OBJECT,
                properties: {
                  description: {
                    type: Type.STRING,
                    description: "The name or description of the item or service."
                  },
                  quantity: {
                    type: Type.NUMBER,
                    description: "The quantity of the item. Default to 1 if not specified."
                  },
                  unitPrice: {
                    type: Type.NUMBER,
                    description: "The price per single unit of the item as a number."
                  }
                },
                required: ["description", "quantity", "unitPrice"]
              }
            }
          },
          required: ["items"]
        }
      }
    });

    // Parse the generated JSON response
    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from AI model");
    }

    const generatedQuote = JSON.parse(responseText);

    // Calculate item amounts and subtotal
    let subtotal = 0;
    if (generatedQuote.items && Array.isArray(generatedQuote.items)) {
      generatedQuote.items = generatedQuote.items.map((item: any) => {
        const amount = (item.quantity || 1) * (item.unitPrice || 0);
        subtotal += amount;
        return {
          ...item,
          amount
        };
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        description: generatedQuote.description || "",
        items: generatedQuote.items || [],
        subtotal
      }
    });

  } catch (error: any) {
    console.error("Error generating quote from AI:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: "Validation error", errors: error.errors });
    }

    return res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to generate quote using AI." 
    });
  }
};

// Request Validation Schema for Enhance Text
const EnhanceTextSchema = z.object({
  text: z.string().min(1),
  mode: z.enum(['line_item', 'note'])
});

export const enhanceText = async (req: Request, res: Response): Promise<any> => {
  try {
    const validatedData = EnhanceTextSchema.parse(req.body);
    const aiClient = getAI();

    let prompt = "";
    if (validatedData.mode === 'line_item') {
      prompt = `You are a professional business writer. A user has typed a brief or lazy description for an invoice line item: "${validatedData.text}". 
Rewrite this into a premium, detailed, and professional description. Keep it concise but make it sound highly professional. Return ONLY the rewritten text, nothing else.`;
    } else {
      prompt = `You are a professional legal assistant. A user has typed brief notes for their invoice/quote terms: "${validatedData.text}". 
Expand this into a fully professional, legally sound, and polite paragraph of terms and conditions. Return ONLY the expanded text, nothing else.`;
    }

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
    });

    const enhancedText = response.text?.trim();

    return res.status(200).json({
      success: true,
      data: { text: enhancedText }
    });

  } catch (error: any) {
    console.error("Error enhancing text:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: "Validation error", errors: error.errors });
    }
    return res.status(500).json({ success: false, message: "Failed to enhance text" });
  }
};

const DraftEmailSchema = z.object({
  documentType: z.enum(['QUOTE', 'INVOICE']),
  documentDetails: z.any(),
  clientDetails: z.any(),
  clientHistory: z.any().optional(),
  businessName: z.string().optional().default('Your Business'),
  currency: z.string().optional().default('USD'),
  isOverdue: z.boolean().optional().default(false)
});

export const draftEmail = async (req: Request, res: Response): Promise<any> => {
  try {
    const validatedData = DraftEmailSchema.parse(req.body);
    const aiClient = getAI();

    const { documentType, documentDetails, clientDetails, clientHistory, businessName, currency, isOverdue } = validatedData;
    const docName = documentType === 'INVOICE' ? 'Invoice' : 'Quote';
    const amount = documentDetails.total || documentDetails.subtotal || 0;
    const clientName = clientDetails?.name || 'Client';

    let prompt = `You are a highly professional administrative assistant for "${businessName}", drafting an email to send a ${docName} to a client.
Client Name: ${clientName}
Document Amount: ${currency} ${amount}
Document Number: ${documentDetails.number || documentDetails.invoiceNumber || documentDetails.quoteNumber || 'N/A'}`;

    if (clientHistory) {
      if (clientHistory.isNewClient) {
        prompt += `\nContext: This is a new client. Welcome them warmly and thank them for choosing ${businessName} for the first time.`;
      } else {
        prompt += `\nContext: This is an existing, returning client. They have received ${clientHistory.totalInvoices} invoices and ${clientHistory.totalQuotes} quotes from us in the past. Express appreciation for their continued partnership and loyalty.`;
      }
    }

    if (isOverdue) {
      prompt += `\nCRITICAL CONTEXT: This invoice is OVERDUE. 
Draft a polite but firm payment reminder email. Ask them to process the payment as soon as possible.`;
    } else {
      prompt += `\nDraft a highly personalized, polite, and persuasive email body tailored to sending this new ${docName}. 
Thank them for their business and provide a brief friendly note.`;
    }

    prompt += `\n\nReturn ONLY the email body text. Do not include a subject line. Keep it concise, warm, and professional. Sign off politely as "${businessName}".`;

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
    });

    const emailBody = response.text?.trim();

    return res.status(200).json({
      success: true,
      data: { text: emailBody }
    });

  } catch (error: any) {
    console.error("Error drafting email:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: "Validation error", errors: error.errors });
    }
    return res.status(500).json({ success: false, message: "Failed to draft email" });
  }
};

const ChatRevenueSchema = z.object({
  prompt: z.string().min(1),
  data: z.object({
    invoices: z.array(z.any()),
    quotes: z.array(z.any()),
    clients: z.array(z.any())
  })
});

export const chatWithRevenue = async (req: Request, res: Response): Promise<any> => {
  try {
    const validatedData = ChatRevenueSchema.parse(req.body);
    const aiClient = getAI();

    // The data is already stripped of PII by the frontend
    const businessDataStr = JSON.stringify(validatedData.data, null, 2);

    const systemPrompt = `You are an expert financial analyst, accountant, and business advisor.
You are helping the user understand their business data through a conversational interface.

Here is a summary of the user's business data (with sensitive personal information removed for security):
\`\`\`json
${businessDataStr}
\`\`\`

USER PROMPT: "${validatedData.prompt}"

INSTRUCTIONS:
- Analyze the provided data to answer the user's question accurately.
- Provide insights, calculations, or summaries if relevant (e.g., total revenue, overdue amounts, best clients).
- Keep your tone professional, concise, and helpful.
- Format your response using markdown for readability (use bolding, bullet points, or tables if useful).
- If the data provided doesn't contain the answer, politely say so. Do not make up numbers.
`;

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: systemPrompt,
    });

    return res.status(200).json({
      success: true,
      data: { text: response.text?.trim() }
    });

  } catch (error: any) {
    console.error("Error in chatWithRevenue:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: "Validation error", errors: error.errors });
    }
    return res.status(500).json({ success: false, message: "Failed to process insights chat" });
  }
};
