import { supabase } from '../lib/supabase';

/**
 * Extract the real error message from a failed Edge Function call.
 *
 * `supabase.functions.invoke` sets `error.message` to the generic
 * "Edge Function returned a non-2xx status code" for ANY non-2xx response. The
 * actual JSON body — which is where the `ai` function puts its genuinely useful
 * messages ("You have reached the free tier limit of 10 AI requests…",
 * "The AI CFO Report is available on the Pro plan", "Too many requests…") —
 * lives on `error.context` as a `Response` and has to be read deliberately.
 *
 * Without this, every server-side refusal surfaced to the user as an
 * indistinguishable "I'm having trouble connecting", which is why quota and
 * plan limits looked like the assistant being broken.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toMeaningfulError = async (error: any, fallback: string): Promise<Error> => {
  try {
    const res = error?.context;
    if (res && typeof res.json === 'function') {
      const body = await res.clone().json();
      const msg = body?.message || body?.error;
      if (msg) return new Error(String(msg));
    }
  } catch {
    // Body was not JSON, or already consumed — fall through.
  }
  return new Error(error?.message || fallback);
};

/**
 * Single call path for every AI endpoint. Previously these five functions each
 * repeated the same offline guard and error handling, and each lost the server
 * message in the same way.
 */
const invokeAi = async <T = any>(
  endpoint: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
  fallbackMessage: string
): Promise<T> => {
  if (!navigator.onLine) {
    throw new Error('You need an active internet connection to use AI features. Everything else in BillReve keeps working offline.');
  }

  const { data, error } = await supabase.functions.invoke(`ai/${endpoint}`, { body: payload });

  if (error) {
    throw await toMeaningfulError(error, fallbackMessage);
  }

  if (!data?.success) {
    throw new Error(data?.message || data?.error || fallbackMessage);
  }

  return data.data as T;
};

export const generateAiQuote = (payload: {
  text?: string;
  documents?: { mimeType: string; data: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  businessProfile?: any;
}) => invokeAi('generate-quote', payload, 'Failed to generate quote');

export const enhanceAiText = (payload: {
  text: string;
  mode: 'line_item' | 'note';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  businessProfile?: any;
}) => invokeAi<{ text: string }>('enhance-text', payload, 'Failed to enhance text');

export const draftAiEmail = (payload: {
  documentType: 'QUOTE' | 'INVOICE';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  documentDetails: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientDetails: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientHistory?: any;
  businessName?: string;
  currency?: string;
  isOverdue?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  businessProfile?: any;
}) => invokeAi<{ text: string }>('draft-email', payload, 'Failed to draft email');

export const chatWithRevenue = (payload: {
  prompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  businessProfile?: any;
  currentView?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  history?: any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) => invokeAi<any>('insights', payload, 'Failed to chat with revenue AI');

export const generateCfoReport = (payload: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  businessProfile?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metrics: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) => invokeAi<any>('cfo-report', payload, 'Failed to generate CFO report');
