import type { Invoice, Client } from '../types';

/**
 * Generates a country-specific CSV report for revenue.
 */
export const generateTaxReportCsv = (invoices: Invoice[], clients: Client[], country: string) => {
  let headers: string[] = [];
  
  if (country === 'US') {
    headers = ['Date', 'Invoice Number', 'Client Name', 'Status', 'Subtotal', 'State Tax', 'Federal Tax', 'Net Amount'];
  } else if (country === 'GB') {
    headers = ['Date', 'Invoice Number', 'Client Name', 'Status', 'Subtotal', 'VAT', 'Net Amount'];
  } else {
    // Default to FIRS (Nigeria) or generic
    headers = ['Date', 'Invoice Number', 'Client Name', 'Status', 'Subtotal', 'VAT Amount', 'WHT Amount', 'Net Amount'];
  }

  const rows = invoices.map(inv => {
    const client = clients.find(c => c.localId === inv.clientId);
    const clientName = client ? client.name : inv.clientId;
    const date = inv.issuedAt ? new Date(inv.issuedAt).toISOString().split('T')[0] : new Date(inv.createdAt).toISOString().split('T')[0];
    const invoiceNum = inv.invoiceNumber || inv.localId.slice(0, 8);
    const escapedName = `"${clientName.replace(/"/g, '""')}"`;
    
    if (country === 'US') {
      const stateTax = inv.taxes?.find(t => t.name.toLowerCase().includes('state'))?.amount || 0;
      const fedTax = inv.taxes?.find(t => t.name.toLowerCase().includes('federal'))?.amount || 0;
      return [date, invoiceNum, escapedName, inv.status, inv.subtotal.toFixed(2), stateTax.toFixed(2), fedTax.toFixed(2), inv.total.toFixed(2)].join(',');
    } else if (country === 'GB') {
      const vat = inv.taxes?.find(t => t.name.toLowerCase().includes('vat'))?.amount || 0;
      return [date, invoiceNum, escapedName, inv.status, inv.subtotal.toFixed(2), vat.toFixed(2), inv.total.toFixed(2)].join(',');
    } else {
      const vat = inv.taxes?.find(t => t.name.toLowerCase().includes('vat'))?.amount || 0;
      const wht = inv.taxes?.find(t => t.name.toLowerCase().includes('wht'))?.amount || 0;
      return [date, invoiceNum, escapedName, inv.status, inv.subtotal.toFixed(2), vat.toFixed(2), wht.toFixed(2), inv.total.toFixed(2)].join(',');
    }
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  if ((navigator as any).msSaveBlob) { // IE 10+
    (navigator as any).msSaveBlob(blob, 'Tax_Report.csv');
  } else {
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `Tax_Report_${country}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }
};
export const exportToCsv = (filename: string, headers: string[], rows: any[][]) => {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => "" + String(cell).replace(/"/g, '""""') + "").join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  if ((navigator as any).msSaveBlob) {
    (navigator as any).msSaveBlob(blob, filename);
  } else {
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }
};
