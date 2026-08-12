import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { GoogleGenAI, Type } from "npm:@google/genai";
import { z } from "npm:zod";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop(); // Gets 'generate-quote', 'enhance-text', etc.

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in the environment.");
    }

    const aiClient = new GoogleGenAI({ apiKey });

    // Ensure it's a POST request
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Authenticate and Rate Limit
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Rate Limit: 10 requests per 1 minute (adjust as needed)
    const { data: isAllowed, error: rateLimitError } = await supabaseClient.rpc('check_and_log_rate_limit', {
      p_user_id: user.id,
      p_endpoint: 'ai/' + path,
      p_limit: 10,
      p_window_minutes: 1
    });

    if (rateLimitError) {
      console.error('Rate Limit Error:', rateLimitError);
    } else if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();

    // Route based on the path
    switch (path) {
      case 'generate-quote':
        return await handleGenerateQuote(aiClient, body);
      case 'enhance-text':
        return await handleEnhanceText(aiClient, body);
      case 'draft-email':
        return await handleDraftEmail(aiClient, body);
      case 'draft-campaign':
        return await handleDraftCampaign(aiClient, body);
      case 'insights':
        return await handleInsights(aiClient, body);
      default:
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (error: any) {
    console.error("AI Error:", error);
    const isZodError = error.errors && Array.isArray(error.errors);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: isZodError ? "Validation error" : (error.message || "An unexpected error occurred"),
        errors: isZodError ? error.errors : undefined
      }), 
      { 
        status: isZodError ? 400 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// --- Handlers ---

async function handleGenerateQuote(aiClient: GoogleGenAI, body: any) {
  const schema = z.object({
    text: z.string().optional(),
    documentType: z.enum(['QUOTE', 'INVOICE']).optional().default('QUOTE'),
    documents: z.array(z.object({
      mimeType: z.string(),
      data: z.string() // base64 string
    })).optional(),
    businessProfile: z.any().optional()
  }).refine(data => data.text || (data.documents && data.documents.length > 0), {
    message: "Either text or at least one document must be provided."
  });

  const validatedData = schema.parse(body);
  const docTypeName = validatedData.documentType === 'INVOICE' ? 'Invoice' : 'Quote';

  const prompt = `You are a professional invoicing assistant. 
Your task is to parse the provided text or document(s) into a structured ${docTypeName}.
Extract all line items, their descriptions, quantities, and unit prices.
If a quantity is not specified, assume 1.
If the notes mention a general description, use that for the ${docTypeName.toLowerCase()} description.
Ensure all prices are represented as numbers (do not include currency symbols).

Context about the business:
${validatedData.businessProfile?.name ? `Business Name: ${validatedData.businessProfile.name}` : ''}
${validatedData.businessProfile?.industry ? `Industry: ${validatedData.businessProfile.industry}` : ''}
${validatedData.businessProfile?.businessDescription ? `What they do: ${validatedData.businessProfile.businessDescription}` : ''}
Use this context to accurately interpret line items (e.g., industry-specific jargon or services).`;

  const contents: any[] = [];
  contents.push({ text: prompt });

  if (validatedData.text) {
    contents.push({ text: `Notes from user: ${validatedData.text}` });
  }

  if (validatedData.documents && validatedData.documents.length > 0) {
    for (const doc of validatedData.documents) {
      const base64Data = doc.data.includes('base64,') ? doc.data.split('base64,')[1] : doc.data;
      contents.push({
        inlineData: {
          mimeType: doc.mimeType,
          data: base64Data
        }
      });
    }
  }

  const response = await aiClient.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: `A brief description or summary of the entire ${docTypeName.toLowerCase()} based on the context.` },
          items: {
            type: Type.ARRAY,
            description: "The list of items or services to be quoted.",
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING, description: "The name or description of the item or service." },
                quantity: { type: Type.NUMBER, description: "The quantity of the item. Default to 1 if not specified." },
                unitPrice: { type: Type.NUMBER, description: "The price per single unit of the item as a number." }
              },
              required: ["description", "quantity", "unitPrice"]
            }
          }
        },
        required: ["items"]
      }
    }
  });

  const responseText = response.text;
  if (!responseText) throw new Error("Empty response from AI model");

  const generatedQuote = JSON.parse(responseText);

  let subtotal = 0;
  if (generatedQuote.items && Array.isArray(generatedQuote.items)) {
    generatedQuote.items = generatedQuote.items.map((item: any) => {
      const amount = (item.quantity || 1) * (item.unitPrice || 0);
      subtotal += amount;
      return { ...item, amount };
    });
  }

  return new Response(JSON.stringify({
    success: true,
    data: {
      description: generatedQuote.description || "",
      items: generatedQuote.items || [],
      subtotal
    }
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleEnhanceText(aiClient: GoogleGenAI, body: any) {
  const schema = z.object({
    text: z.string().min(1),
    mode: z.enum(['line_item', 'note'])
  });

  const validatedData = schema.parse(body);

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

  return new Response(JSON.stringify({
    success: true,
    data: { text: response.text?.trim() }
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleDraftEmail(aiClient: GoogleGenAI, body: any) {
  const schema = z.object({
    documentType: z.enum(['QUOTE', 'INVOICE']),
    documentDetails: z.any(),
    clientDetails: z.any(),
    clientHistory: z.any().optional(),
    businessName: z.string().optional().default('Your Business'),
    currency: z.string().optional().default('USD'),
    isOverdue: z.boolean().optional().default(false),
    businessProfile: z.any().optional()
  });

  const validatedData = schema.parse(body);
  const { documentType, documentDetails, clientDetails, clientHistory, businessName, currency, isOverdue } = validatedData;
  const docName = documentType === 'INVOICE' ? 'Invoice' : 'Quote';
  const amount = documentDetails.total || documentDetails.subtotal || 0;
  const clientName = clientDetails?.name || 'Client';

  let prompt = `You are a highly professional administrative assistant for "${businessName}", drafting an email to send a ${docName} to a client.
Client Name: ${clientName}
Document Amount: ${currency} ${amount}
Document Number: ${documentDetails.number || documentDetails.invoiceNumber || documentDetails.quoteNumber || 'N/A'}`;

  if (validatedData.businessProfile?.industry || validatedData.businessProfile?.businessDescription) {
    prompt += `\nBusiness Context: ${businessName} is in the ${validatedData.businessProfile.industry || 'Business'} industry. ${validatedData.businessProfile.businessDescription || ''} Tailor the tone of the email to match this professional industry context.`;
  }

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

  prompt += `\n\nReturn ONLY the email body text. Do not include a subject line. Do not start with a greeting like "Hello [Client]" or "Dear [Client]", just write the core message itself. Keep it concise, warm, and professional. Sign off politely as "${businessName}".`;

  const response = await aiClient.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: prompt,
  });

  return new Response(JSON.stringify({
    success: true,
    data: { text: response.text?.trim() }
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleDraftCampaign(aiClient: GoogleGenAI, body: any) {
  const schema = z.object({
    businessName: z.string().optional().default('Your Business'),
    businessProfile: z.any().optional(),
    campaignContext: z.string().optional().default('A general update')
  });

  const validatedData = schema.parse(body);
  const { businessName, businessProfile, campaignContext } = validatedData;

  let prompt = `You are a highly professional marketing copywriter for "${businessName}". 
Draft a professional, engaging marketing email or campaign announcement to send to clients.
Context / Goal of this campaign: ${campaignContext}`;

  if (businessProfile?.industry || businessProfile?.businessDescription) {
    prompt += `\nBusiness Context: ${businessProfile.industry ? `Industry: ${businessProfile.industry}. ` : ''}${businessProfile.businessDescription ? `What we do: ${businessProfile.businessDescription}` : ''}`;
  }

  prompt += `\n\nEnsure the email has a friendly, professional tone. Include a clear subject line at the very top formatted exactly as "SUBJECT: <your subject here>". Do not include placeholder brackets like [Client Name] if possible, just write the copy naturally. Do not include signature blocks, just end with a friendly sign-off.`;

  const response = await aiClient.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: prompt,
  });

  const rawText = response.text || '';
  let subject = '';
  let content = rawText;

  // Extract subject if present
  const subjectMatch = rawText.match(/SUBJECT:\s*(.+)/i);
  if (subjectMatch) {
    subject = subjectMatch[1].trim();
    content = rawText.replace(subjectMatch[0], '').trim();
  }

  return new Response(JSON.stringify({
    success: true,
    data: { 
      subject,
      content 
    }
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleInsights(aiClient: GoogleGenAI, body: any) {
  const schema = z.object({
    prompt: z.string().min(1),
    data: z.object({
      invoices: z.array(z.any()),
      quotes: z.array(z.any()),
      clients: z.array(z.any())
    }),
    businessProfile: z.any().optional(),
    currentView: z.string().optional(),
    history: z.array(z.object({
      role: z.enum(['user', 'model']),
      parts: z.array(z.object({ text: z.string() }))
    })).optional()
  });

  const validatedData = schema.parse(body);
  const businessDataStr = JSON.stringify(validatedData.data, null, 2);
  const defaultCurrency = validatedData.businessProfile?.currency || 'USD';

  const systemPrompt = `You are an expert financial analyst, accountant, and business advisor.
You are helping the user understand their business data through a conversational interface.

Business Context:
- Name: ${validatedData.businessProfile?.name || 'A business'}
- Industry: ${validatedData.businessProfile?.industry || 'Unspecified'}
- What they do: ${validatedData.businessProfile?.businessDescription || 'Unspecified'}
- Default Currency: ${defaultCurrency}

User Interface Context:
- The user is currently viewing the app from the: ${validatedData.currentView === '/dashboard' ? 'Dashboard page' : validatedData.currentView === '/reports' ? 'Reports & Analytics page' : validatedData.currentView || 'App'}

Here is a summary of the user's business data (with sensitive personal information removed for security):
\`\`\`json
${businessDataStr}
\`\`\`

INSTRUCTIONS & PROTOCOLS:
1. Data Analysis: Analyze the provided data to answer the user's question accurately. Format the "text" part of your response using markdown for readability. If the data doesn't contain the answer, politely say so. Do not make up numbers.
2. /create Wizard Protocol: If the user indicates they want to create a document or client (e.g. "/create"), DO NOT emit an action yet. Instead, ask them one question at a time to gather the missing pieces. You MUST collect information that matches our strict database structures:
   - For a Client: Company/Name (Required), Email, Phone, Address.
   - For an Invoice: Client Details, Project/Description, Terms & Notes, Due Date, Receiving Bank, Line Items (Description, Qty, Rate, Amount), Taxes (If yes, provide array: [{ id: "vat", name: "VAT", rate: 7.5, type: "PERCENTAGE" }, { id: "wht", name: "WHT", rate: 5, type: "PERCENTAGE" }]).
   - For a Quote: Client Details, Project/Description, Terms & Notes, Expiry Date, Line Items (Description, Qty, Rate, Amount), Taxes (If yes, provide array), Document Settings (Allow counter offer).
   IMPORTANT DEFAULTS: 
   - For "Terms & Notes": DO NOT ask the user for terms by default. Use a generic professional statement (e.g., "Thank you for your business. Payment is due within the specified terms.") UNLESS the user explicitly mentions they want custom terms.
   - For Quotes ONLY: You MUST explicitly ask the user "Would you like to enable counter-offers for this quote?" before finalizing and creating the quote.
   Ask for other missing details sequentially and naturally. Once all details are gathered, output the JSON action.
3. Client Query Protocol (@client): If the user asks about a specific client or uses "@ ClientName", find them in the JSON data, cross-reference their invoices/quotes, and summarize their Total Outstanding Balance, Total Paid, and a brief markdown list of their documents.
4. Data Listing Commands: If the user types "/client", summarize all clients. If they type "/quote", summarize recent quotes. If they type "/invoice", summarize recent invoices. Use markdown tables if helpful.
5. Client Existence Validation: If the user wants to create a document for a client, YOU MUST verify the client exists in the JSON data. If they do not exist, DO NOT emit a CREATE action. Instead, output text asking if they want to create that client first.
6. Currency Enforcement: If the user mentions a currency different from the Default Currency (${defaultCurrency}), you MUST save the payload amounts using the default currency. In your text response, politely notify them that you used the default currency instead.

ACTION CAPABILITIES:
You can execute actions by including the "action" object in your JSON response.

Supported Action Types:
- "CREATE_INVOICE": Payload { clientId: string, amount: number, description: "string (Project description provided first)", notes: "string (Terms & notes. Never blank, generate default if missing)", dueDate: "string (YYYY-MM-DD)", items: [{ description: "string (Line item description)", quantity: number, unitPrice: number }], taxes: [{ id: "string (e.g. VAT)", name: "string", rate: number, type: "PERCENTAGE" | "FLAT" }] }
- "CREATE_QUOTE": Payload { clientId: string, amount: number, description: "string (Project description provided first)", notes: "string (Terms & notes. Never blank, generate default if missing)", expiresAt: "string (YYYY-MM-DD)", items: [{ description: "string (Line item description)", quantity: number, unitPrice: number }], taxes: [{ id: "string (e.g. VAT)", name: "string", rate: number, type: "PERCENTAGE" | "FLAT" }], allowCounterOffer: boolean }
- "CREATE_CLIENT": Payload { name: string, email?: string }
- "DELETE_INVOICE": Payload { invoiceId: string }
- "DELETE_QUOTE": Payload { quoteId: string }
- "DELETE_CLIENT": Payload { clientId: string }
- "SEND_DOCUMENT": Payload { documentId: string, documentType: "Invoice" | "Quote" }
- "NAVIGATE_EDIT": Payload { route: string }

CRITICAL: You MUST respond ONLY with a valid JSON object matching this schema:
{
  "text": "Your markdown response here",
  "action": {
    "type": "CREATE_INVOICE | DELETE_CLIENT | etc...",
    "payload": { ... }
  } // optional
}
`;

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: '{ "text": "Understood. I will follow the protocols and respond only with the valid JSON schema." }' }] },
    ...(validatedData.history || []),
    { role: 'user', parts: [{ text: validatedData.prompt }] }
  ];

  const response = await aiClient.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: contents as any,
    config: {
      responseMimeType: "application/json",
    }
  });

  let parsedResponse = { text: "I'm sorry, I couldn't process that." };
  try {
    if (response.text) {
      parsedResponse = JSON.parse(response.text.trim());
    }
  } catch (e) {
    console.error("Failed to parse Gemini JSON:", response.text);
    parsedResponse.text = response.text || parsedResponse.text;
  }

  return new Response(JSON.stringify({
    success: true,
    data: parsedResponse
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
