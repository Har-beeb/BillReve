export type SubscriptionPlan = 'FREE' | 'PRO' | 'ENTERPRISE';
export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'COUNTERED';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'COUNTERED';
export type SyncStatus = 'synced' | 'pending' | 'failed' | 'syncing';

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  isDefault: boolean;
}

export interface BusinessProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
  logoUrl?: string; // Base64 string for now
  bankAccounts: BankAccount[];
  paystackPublicKey?: string;
  paystackSecretKey?: string;
  flutterwavePublicKey?: string;
  flutterwaveSecretKey?: string;
  country: string; // e.g., 'NG', 'US', 'GB'
  currency: string; // e.g., 'NGN', 'USD', 'GBP'
}

export interface TaxSetting {
  id: string;
  name: string; // e.g., 'VAT', 'WHT', 'State Tax'
  rate: number; // e.g., 7.5
  isDeduction: boolean;
  isActive: boolean;
}

export interface Client {
  id?: string;
  localId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  deletedAt?: string;
}

export interface Quote {
  id?: string;
  localId: string;
  userId?: string;
  quoteNumber?: string; // e.g., QTE-001
  clientId: string;
  description?: string;
  notes?: string;
  status: QuoteStatus;
  currency: string;
  subtotal: number;
  taxes: { name: string, amount: number, isDeduction: boolean }[];
  total: number;
  invoiceId?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  deletedAt?: string;
  items: QuoteItem[];
  counterAmount?: number;
  clientMessage?: string;
  allowCounterOffer?: boolean;
}

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id?: string;
  localId: string;
  userId?: string;
  invoiceNumber?: string; // e.g., INV-001
  clientId: string;
  description?: string;
  notes?: string;
  bankAccountId?: string | null;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  taxes: { name: string, amount: number, isDeduction: boolean }[];
  total: number;
  amountPaid: number;
  isRecurring: boolean;
  nextIssueOn?: string | null;
  quoteId?: string | null;
  issuedAt?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  deletedAt?: string;
  items: InvoiceItem[];
  counterAmount?: number;
  clientMessage?: string;
  allowCounterOffer?: boolean;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface SyncQueueItem {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'CLIENT' | 'QUOTE' | 'INVOICE';
  payload: Record<string, unknown>;
  createdAt: string;
  status: 'pending' | 'failed';
  error?: string;
}
