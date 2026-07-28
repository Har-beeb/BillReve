const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const generateAiQuote = async (payload: { text?: string; documents?: { mimeType: string; data: string }[] }) => {
  const response = await fetch(`${API_URL}/ai/generate-quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || 'Failed to generate quote');
  }

  return result.data;
};

export const enhanceAiText = async (payload: { text: string; mode: 'line_item' | 'note' }) => {
  const response = await fetch(`${API_URL}/ai/enhance-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || 'Failed to enhance text');
  }

  return result.data;
};

export const draftAiEmail = async (payload: { 
  documentType: 'QUOTE' | 'INVOICE', 
  documentDetails: any, 
  clientDetails: any, 
  clientHistory?: any,
  businessName?: string,
  currency?: string,
  isOverdue?: boolean 
}) => {
  const response = await fetch(`${API_URL}/ai/draft-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || 'Failed to draft email');
  }

  return result.data;
};

export const chatWithRevenue = async (payload: { prompt: string; data: any }) => {
  const response = await fetch(`${API_URL}/ai/insights`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || 'Failed to chat with revenue AI');
  }

  return result.data;
};
