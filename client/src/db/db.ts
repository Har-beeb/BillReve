import Dexie, { type Table } from 'dexie';
import type { Client, Invoice, Quote, RecurringSchedule, SyncQueueItem } from '../types';

export class BillReveDatabase extends Dexie {
  clients!: Table<Client, string>;
  quotes!: Table<Quote, string>;
  invoices!: Table<Invoice, string>;
  recurringSchedules!: Table<RecurringSchedule, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('BillFlowDatabase'); // Kept as BillFlowDatabase for backwards compatibility so returning users do not lose their local IndexedDB data.

    
    // Define tables and indexes
    // Note: only properties that we want to query against need to be indexed.
    // 'localId' is the primary key (using & to denote uniqueness if applicable, but we use it as PK)
    this.version(1).stores({
      clients: 'localId, name, syncStatus, updatedAt',
      quotes: 'localId, clientId, status, syncStatus, updatedAt',
      invoices: 'localId, clientId, status, syncStatus, dueDate, updatedAt',
      syncQueue: 'id, entity, action, status, createdAt'
    });

    // Version 2: Migrate all monetary fields to integer minor units (cents)
    this.version(2).upgrade(tx => {
      tx.table('invoices').toCollection().modify((invoice: any) => {
        invoice.subtotal = Math.round(invoice.subtotal * 100);
        invoice.total = Math.round(invoice.total * 100);
        invoice.amountPaid = Math.round((invoice.amountPaid || 0) * 100);
        if (invoice.counterAmount) invoice.counterAmount = Math.round(invoice.counterAmount * 100);
        if (invoice.taxes) {
          invoice.taxes.forEach((t: any) => t.amount = Math.round(t.amount * 100));
        }
        if (invoice.items) {
          invoice.items.forEach((i: any) => {
            i.unitPrice = Math.round(i.unitPrice * 100);
            i.amount = Math.round(i.amount * 100);
          });
        }
      });
      tx.table('quotes').toCollection().modify((quote: any) => {
        quote.subtotal = Math.round(quote.subtotal * 100);
        quote.total = Math.round(quote.total * 100);
        if (quote.counterAmount) quote.counterAmount = Math.round(quote.counterAmount * 100);
        if (quote.minimumCounterAmount) quote.minimumCounterAmount = Math.round(quote.minimumCounterAmount * 100);
        if (quote.taxes) {
          quote.taxes.forEach((t: any) => t.amount = Math.round(t.amount * 100));
        }
        if (quote.items) {
          quote.items.forEach((i: any) => {
            i.unitPrice = Math.round(i.unitPrice * 100);
            i.amount = Math.round(i.amount * 100);
          });
        }
      });
    });

    // Version 3: Add deletedAt to indexes for Trash queries
    this.version(3).stores({
      clients: 'localId, name, syncStatus, updatedAt, deletedAt',
      quotes: 'localId, clientId, status, syncStatus, updatedAt, deletedAt',
      invoices: 'localId, clientId, status, syncStatus, dueDate, updatedAt, deletedAt',
    }).upgrade(_tx => {
      // Just a schema change to add the index, no data transformation needed.
    });

    // Version 4: Add recurring schedules
    this.version(4).stores({
      recurringSchedules: 'localId, clientId, status, syncStatus, deletedAt, nextRunDate'
    });
  }
}

export const db = new BillReveDatabase();
