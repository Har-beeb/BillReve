import { supabase } from '../lib/supabase';

export const generateAiQuote = async (payload: { text?: string; documents?: { mimeType: string; data: string }[]; businessProfile?: any }) => {
  if (!navigator.onLine) throw new Error('You need an active internet connection to use AI features.');
  const { data, error } = await supabase.functions.invoke('ai/generate-quote', {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || 'Failed to generate quote');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to generate quote');
  }

  return data.data;
};

export const enhanceAiText = async (payload: { text: string; mode: 'line_item' | 'note'; businessProfile?: any }) => {
  if (!navigator.onLine) throw new Error('You need an active internet connection to use AI features.');
  const { data, error } = await supabase.functions.invoke('ai/enhance-text', {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || 'Failed to enhance text');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to enhance text');
  }

  return data.data;
};

export const draftAiEmail = async (payload: { 
  documentType: 'QUOTE' | 'INVOICE', 
  documentDetails: any, 
  clientDetails: any, 
  clientHistory?: any,
  businessName?: string,
  currency?: string,
  isOverdue?: boolean,
  businessProfile?: any
}) => {
  if (!navigator.onLine) throw new Error('You need an active internet connection to use AI features.');
  const { data, error } = await supabase.functions.invoke('ai/draft-email', {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || 'Failed to draft email');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to draft email');
  }

  return data.data;
};

export const chatWithRevenue = async (payload: { prompt: string; data: any; businessProfile?: any; currentView?: string; history?: any[] }) => {
  if (!navigator.onLine) throw new Error('You need an active internet connection to use AI features.');
  const { data, error } = await supabase.functions.invoke('ai/insights', {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || 'Failed to chat with revenue AI');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to chat with revenue AI');
  }

  return data.data;
};

export const generateCfoReport = async (payload: { data: any; businessProfile?: any; metrics: any }) => {
  if (!navigator.onLine) throw new Error('You need an active internet connection to use AI features.');
  const { data, error } = await supabase.functions.invoke('ai/cfo-report', {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || 'Failed to generate CFO report');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to generate CFO report');
  }

  return data.data;
};
