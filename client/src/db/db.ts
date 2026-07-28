import Dexie, { type Table } from 'dexie';
import type { Client, Invoice, Quote, SyncQueueItem } from '../types';

export class BillFlowDatabase extends Dexie {
  clients!: Table<Client, string>;
  quotes!: Table<Quote, string>;
  invoices!: Table<Invoice, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('BillFlowDatabase');
    
    // Define tables and indexes
    // Note: only properties that we want to query against need to be indexed.
    // 'localId' is the primary key (using & to denote uniqueness if applicable, but we use it as PK)
    this.version(1).stores({
      clients: 'localId, name, syncStatus, updatedAt',
      quotes: 'localId, clientId, status, syncStatus, updatedAt',
      invoices: 'localId, clientId, status, syncStatus, dueDate, updatedAt',
      syncQueue: 'id, entity, action, status, createdAt'
    });
  }
}

export const db = new BillFlowDatabase();
