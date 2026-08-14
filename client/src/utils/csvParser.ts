import Papa from 'papaparse';

export type ImportType = 'clients' | 'invoices' | 'quotes';

export const CSV_TEMPLATES = {
  clients: [
    ['Name', 'Email', 'Phone', 'Address', 'Company'],
    ['John Doe', 'john@example.com', '+1234567890', '123 Main St', 'Dangote Group'],
    ['Jane Smith', 'jane@example.com', '+0987654321', '456 Market St', 'Globex']
  ],
  invoices: [
    ['Client Name', 'Client Email', 'Invoice Number', 'Issue Date', 'Due Date', 'Status', 'Currency', 'Notes', 'Item 1 Description', 'Item 1 Quantity', 'Item 1 Price'],
    ['John Doe', 'john@example.com', 'INV-001', '2026-07-01', '2026-07-15', 'paid', 'USD', 'Thanks for your business!', 'Web Design', '1', '1500'],
    ['Jane Smith', 'jane@example.com', 'INV-002', '2026-07-10', '2026-07-24', 'pending', 'USD', '', 'SEO Audit', '1', '500']
  ],
  quotes: [
    ['Client Name', 'Client Email', 'Quote Number', 'Issue Date', 'Valid Until', 'Status', 'Currency', 'Notes', 'Item 1 Description', 'Item 1 Quantity', 'Item 1 Price'],
    ['John Doe', 'john@example.com', 'QT-001', '2026-07-01', '2026-07-15', 'accepted', 'USD', 'Estimate for web design', 'Web Design', '1', '1500']
  ]
};

export const downloadTemplate = (type: ImportType) => {
  const csvContent = Papa.unparse(CSV_TEMPLATES[type]);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `billreve_${type}_template.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const parseCSV = (file: File): Promise<Papa.ParseResult<any>> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results),
      error: (error: any) => reject(error)
    });
  });
};
