import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DocumentPreview } from './DocumentPreview';

vi.mock('../store/useAppStore', () => ({
  useAppStore: Object.assign(
    vi.fn(() => ({
      fontFamily: 'Inter',
      fontSize: 'medium',
      isProUser: true,
    })),
    {
      getState: vi.fn().mockReturnValue({
        fontFamily: 'Inter',
        fontSize: 'medium',
        isProUser: true,
      })
    }
  )
}));

vi.mock('lucide-react', () => ({
  Eye: () => <div data-testid="eye-icon" />
}));

vi.mock('./ui/Logo', () => ({
  Logo: () => <div data-testid="logo" />
}));

describe('DocumentPreview', () => {
  it('renders correctly and matches snapshot', () => {
    const mockDate = new Date('2026-10-09T00:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const businessProfile = {
      name: 'Test Business',
      address: '123 Test St\nTest City, TC 12345',
      logoUrl: 'https://example.com/logo.png',
      bankAccounts: [{ id: 'bank-1', bankName: 'Test Bank', accountName: 'Test Account', accountNumber: '1234567890' }]
    };

    const initialDoc = {
      quoteNumber: 'QT-001'
    };

    const items = [
      { description: 'Item 1', quantity: 2, unitPrice: 50, amount: 100 },
      { description: 'Item 2', quantity: 1, unitPrice: 200, amount: 200 }
    ];

    const computedTaxes = [
      { name: 'VAT (10%)', amount: 30, isDeduction: false }
    ];

    const { container } = render(
      <DocumentPreview 
        businessProfile={businessProfile}
        type="QUOTE"
        documentNumber="QT-001"
        initialDoc={initialDoc}
        clientId="client-1"
        clients={[{ localId: 'client-1', name: 'John Doe', email: 'john@example.com' }]}
        isCreatingClient={false}
        newClientName=""
        newClientEmail=""
        dueDate="2026-10-16T00:00:00Z"
        items={items}
        subtotal={300}
        computedTaxes={computedTaxes}
        total={330}
        description="A test quote"
        notes="Please pay on time."
        bankAccountId="bank-1"
        currency="USD"
        theme="standard"
      />
    );

    expect(container).toMatchSnapshot();
    
    vi.useRealTimers();
  });
});
