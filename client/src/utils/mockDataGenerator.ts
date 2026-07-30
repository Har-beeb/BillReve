import { db } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export const generateMockData = async (userId: string) => {
  if (!userId) {
    alert("You must be logged in to generate data.");
    return;
  }

  try {
    // Generate 15 Clients
    const clients = Array.from({ length: 15 }).map((_, i) => ({
      localId: uuidv4(),
      userId,
      name: `Mock Client ${i + 1}`,
      email: `client${i + 1}@example.com`,
      phone: `+1 555 010${i}`,
      address: `${100 + i} Mockingbird Lane, Business City`,
      createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending' as const
    }));

    await Promise.all(clients.map(c => db.clients.add(c)));
    await Promise.all(clients.map(c => db.syncQueue.add({
      id: uuidv4(),
      action: 'CREATE',
      entity: 'CLIENT',
      payload: c,
      createdAt: new Date().toISOString(),
      status: 'pending'
    })));

    // Generate 25 Invoices (assigned randomly to clients)
    const invoiceStatuses = ['PAID', 'SENT', 'OVERDUE', 'DRAFT', 'PARTIAL', 'COUNTERED'];
    const invoices = Array.from({ length: 25 }).map((_, i) => {
      const client = clients[Math.floor(Math.random() * clients.length)];
      const subtotal = Math.floor(50 + Math.random() * 500) * 1000;
      const status = invoiceStatuses[Math.floor(Math.random() * invoiceStatuses.length)];
      const total = subtotal; // No invisible tax
      
      let amountPaid = 0;
      if (status === 'PAID') amountPaid = total;
      else if (status === 'PARTIAL') amountPaid = total * (0.1 + Math.random() * 0.8);

      const isCountered = status === 'COUNTERED';
      const issuedTime = Date.now() - Math.random() * 31536000000; // Past year
      const issuedAt = new Date(issuedTime).toISOString();
      const dueDate = new Date(issuedTime + (14 + Math.random() * 16) * 86400000).toISOString(); // 14-30 days after issue

      return {
          localId: uuidv4(),
          userId,
          invoiceNumber: `INV-2026-${1000 + i}`,
          clientId: client.localId,
          status: status as any,
          currency: 'NGN',
          subtotal: subtotal,
          total: total,
          amountPaid: amountPaid,
          isRecurring: Math.random() > 0.8,
          taxes: [],
          items: [{ id: uuidv4(), description: 'Professional Services rendered', quantity: 1, unitPrice: subtotal, amount: subtotal }],
          allowCounterOffer: true,
          counterAmount: isCountered ? total * 0.9 : undefined,
          clientMessage: isCountered ? "Can we apply a 10% discount?" : undefined,
          issuedAt,
          dueDate,
          createdAt: issuedAt, // Set created at to match issued at for charting
          updatedAt: issuedAt, // Match issuedAt so Dashboard uses historical dates instead of today
          syncStatus: 'pending' as const
        };
    });
    
    await Promise.all(invoices.map(inv => db.invoices.add(inv)));
    await Promise.all(invoices.map(inv => db.syncQueue.add({
      id: uuidv4(),
      action: 'CREATE',
      entity: 'INVOICE',
      payload: inv,
      createdAt: new Date().toISOString(),
      status: 'pending'
    })));

    // Generate 10 Quotes
    const quoteStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'COUNTERED'];
    const quotes = Array.from({ length: 10 }).map((_, i) => {
      const client = clients[Math.floor(Math.random() * clients.length)];
      const subtotal = Math.floor(100 + Math.random() * 1000) * 1000;
      const status = quoteStatuses[Math.floor(Math.random() * quoteStatuses.length)];
      const total = subtotal;
      
      const isCountered = status === 'COUNTERED';
      
      const issuedTime = Date.now() - Math.random() * 31536000000; // Past year
      const issuedAt = new Date(issuedTime).toISOString();
      const expiresAt = new Date(issuedTime + (14 + Math.random() * 16) * 86400000).toISOString();

      return {
        localId: uuidv4(),
        userId,
        quoteNumber: `QT-2026-${1000 + i}`,
        clientId: client.localId,
        status: status as any,
        currency: 'NGN',
        subtotal: subtotal,
        total: total,
        taxes: [],
        items: [{ id: uuidv4(), description: 'Project Proposal Estimate', quantity: 1, unitPrice: subtotal, amount: subtotal }],
        allowCounterOffer: true,
        counterAmount: isCountered ? total * 0.85 : undefined,
        clientMessage: isCountered ? "Would it be possible to reduce the scope and meet this budget?" : (status === 'DECLINED' ? "We went with another vendor." : undefined),
        issuedAt,
        expiresAt,
        createdAt: issuedAt,
        updatedAt: issuedAt,
        syncStatus: 'pending' as const
      };
    });

    await Promise.all(quotes.map(q => db.quotes.add(q)));
    await Promise.all(quotes.map(q => db.syncQueue.add({
      id: uuidv4(),
      action: 'CREATE',
      entity: 'QUOTE',
      payload: q,
      createdAt: new Date().toISOString(),
      status: 'pending'
    })));

    alert("Successfully generated mock data and queued it for cloud upload! Refreshing page to load...");
    window.location.reload();
  } catch (error) {
    console.error("Failed to generate mock data", error);
    alert("Error generating mock data.");
  }
};

export const clearAllData = async (userId: string) => {
  if (!userId) {
    alert("You must be logged in to clear data.");
    return;
  }
  
  const confirmClear = window.confirm("Are you sure you want to permanently delete ALL clients, invoices, and quotes from both your device and the cloud? This action cannot be undone.");
  if (!confirmClear) return;

  try {
    // 1. Clear Local IndexedDB
    await Promise.all([
      db.clients.clear(),
      db.invoices.clear(),
      db.quotes.clear(),
      db.syncQueue.clear()
    ]);

    // 2. Clear from Supabase (RLS ensures user can only delete their own)
    const { supabase } = await import('../lib/supabase');
    await Promise.all([
      supabase.from('quotes').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    ]);

    alert("Successfully cleared all data from local storage and the cloud.");
    window.location.reload();
  } catch (error) {
    console.error("Failed to clear data", error);
    alert("Error clearing data. Please try again.");
  }
};
