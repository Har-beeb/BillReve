// @refresh reset
import { createRoot } from 'react-dom/client';
import { useAppStore } from '../store/useAppStore';

// @ts-ignore
import html2pdf from 'html2pdf.js/dist/html2pdf.bundle.min.js';
import { formatMoney } from './formatters';

import { getThemeInlineStyles } from './documentThemes';

const PDFTemplate = ({ document, client, profile, type }: { document: any, client: any, profile: any, type: 'QUOTE' | 'INVOICE' }) => {
  const ts = getThemeInlineStyles((document.theme || 'standard') as any);
  
  // Use bank snapshot if available, fallback to profile lookup
  const bank = document.bankAccountSnapshot || (document.bankAccountId ? profile?.bankAccounts?.find((b: any) => b.id === document.bankAccountId) : null);

  return (
    <div id="pdf-template-container" className="font-sans" style={{ minHeight: '1120px', backgroundColor: '#ffffff', color: '#0f172a' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        #pdf-template-container * {
          border-color: transparent;
        }
      `}} />
      <div style={{ padding: '3rem', background: ts.headerBg, color: ts.headerText }}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-4xl font-light tracking-wide" style={{ color: ts.headerText }}>{type}</h2>
            <p className="mt-1" style={{ color: ts.headerText, opacity: 0.8 }}>#{document.invoiceNumber || document.quoteNumber || document.localId?.slice(0,8)}</p>
            {document.description && (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: ts.headerText, opacity: 0.8 }}>Project / Description</p>
                <p className="text-lg font-medium" style={{ color: ts.headerText }}>{document.description}</p>
              </div>
            )}
          </div>
          <div className="text-right flex flex-col items-end">
            {profile?.logoUrl || profile?.logo_url ? (
              <div className="w-16 h-16 mb-2 flex items-center justify-end" style={{ backgroundColor: 'transparent' }}>
                  <img src={profile.logoUrl || profile.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <img src={`${window.location.origin}/billreve.svg`} alt="BillReve Logo" className="w-12 h-12 mb-2 object-contain" />
            )}
            <p className="font-bold">{profile?.name || 'Business Name'}</p>
            <p className="text-sm whitespace-pre-line" style={{ color: ts.headerText, opacity: 0.9 }}>{profile?.address}</p>
          </div>
        </div>
      </div>

      <div className="px-12 py-8 flex justify-between gap-8">
          <div>
            <p className="text-sm font-medium uppercase mb-1" style={{ color: '#94a3b8' }}>Bill To</p>
            <p className="font-bold text-lg">{client?.name || 'Unknown Client'}</p>
            <p style={{ color: '#64748b' }}>{client?.email}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium uppercase mb-1" style={{ color: '#94a3b8' }}>Date Issued</p>
            <p className="font-medium">{new Date(document.createdAt || document.created_at).toLocaleDateString()}</p>
            {document.dueDate && (
              <>
                <p className="text-sm font-medium uppercase mt-4 mb-1" style={{ color: '#94a3b8' }}>Due Date</p>
                <p className="font-medium">{new Date(document.dueDate).toLocaleDateString()}</p>
              </>
            )}
          </div>
      </div>

      <div className="flex-1 mt-4 px-12">
        <table className="w-full text-sm">
          <thead style={{ background: ts.tableHeadBg, color: ts.tableHeadText }}>
            <tr>
              <th className="text-left py-3 pl-4">Description</th>
              <th className="text-right py-3 pr-4 whitespace-nowrap">Qty</th>
              <th className="text-right py-3 pr-4 whitespace-nowrap">Rate</th>
              <th className="text-right py-3 pr-4 whitespace-nowrap">Amount</th>
            </tr>
          </thead>
          <tbody>
            {document.items && document.items.length > 0 ? (
              document.items.map((i: any, idx: number) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? ts.stripeBg : 'transparent' }}>
                  <td className="py-3 pl-4" style={{ color: '#334155' }}>{i.description}</td>
                  <td className="text-right py-3 pr-4 whitespace-nowrap" style={{ color: '#475569' }}>{i.quantity}</td>
                  <td className="text-right py-3 pr-4 whitespace-nowrap" style={{ color: '#475569' }}>{i.unitPrice?.toLocaleString()}</td>
                  <td className="text-right py-3 pr-4 font-medium whitespace-nowrap" style={{ color: '#1e293b' }}>{i.amount?.toLocaleString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center italic" style={{ color: '#94a3b8' }}>No items found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-12 mt-6">
        <div className="w-1/2 ml-auto" style={{ borderTop: `2px solid ${ts.borderColor}`, paddingTop: '1rem' }}>
          <div className="flex justify-between gap-4 text-sm mb-2" style={{ color: '#475569' }}>
            <span className="whitespace-nowrap">Subtotal</span>
            <span className="text-right font-medium">{formatMoney(document.subtotal, document.currency)}</span>
          </div>
          {document.taxes?.map((t: any, idx: number) => (
            <div key={idx} className="flex justify-between gap-4 text-sm mb-2" style={{ color: '#475569' }}>
              <span className="whitespace-nowrap">{t.name}</span>
              <span className="text-right font-medium">{t.isDeduction ? '-' : ''}{formatMoney(t.amount, document.currency)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-4 font-bold text-lg mt-2 pt-2 border-t" style={{ borderColor: '#f1f5f9' }}>
            <span className="whitespace-nowrap">Total</span>
            <span className="text-right" style={{ color: ts.accentColor }}>{formatMoney(document.total, document.currency)}</span>
          </div>
          {document.amountPaid > 0 && (
            <div className="flex justify-between gap-4 font-medium text-sm mt-2" style={{ color: '#16a34a' }}>
              <span className="whitespace-nowrap">Amount Paid</span>
              <span className="text-right">-{formatMoney(document.amountPaid, document.currency)}</span>
            </div>
          )}
          {document.amountPaid > 0 && document.total - document.amountPaid > 0 && (
            <div className="flex justify-between gap-4 font-bold text-lg mt-2 pt-2 border-t" style={{ borderColor: '#f1f5f9' }}>
              <span className="whitespace-nowrap">Balance Due</span>
              <span className="text-right" style={{ color: '#1e293b' }}>{formatMoney(document.total - document.amountPaid, document.currency)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-12">
        {document.notes && (
          <div className="mt-8 p-4 rounded-lg" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', color: '#334155', fontSize: '0.75rem' }}>
            <span className="font-semibold block mb-1" style={{ color: ts.accentColor }}>Terms & Notes:</span>
            <p className="whitespace-pre-line">{document.notes}</p>
          </div>
        )}

        <div className="mt-12 border-t pt-8" style={{ borderColor: '#f1f5f9' }}>
            {bank && (
              <div className="text-sm">
                <p className="font-bold mb-2 uppercase tracking-wide" style={{ color: ts.accentColor }}>Payment Details</p>
                <p style={{ color: '#475569' }}><span className="font-medium">Bank:</span> {bank.bankName}</p>
                <p style={{ color: '#475569' }}><span className="font-medium">Account Name:</span> {bank.accountName || bank.accountName}</p>
                <p style={{ color: '#475569' }}><span className="font-medium">Account Number:</span> {bank.accountNumber}</p>
              </div>
            )}
        </div>

        <div className="mt-16 text-center text-xs w-full pb-8" style={{ color: '#94a3b8' }}>
           Powered by <span className="font-semibold">{useAppStore.getState().isProUser ? (profile?.name || 'BillReve') : 'BillReve'}</span>
        </div>
      </div>
    </div>
  );
};

export const generateDocumentPdf = async (document: any, client: any, profile: any, type: 'QUOTE' | 'INVOICE', download: boolean = false): Promise<string | void> => {
  // Create hidden container
  const container = window.document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  window.document.body.appendChild(container);

  // Render React component
  const root = createRoot(container);
  
  // Monkey-patch getComputedStyle to hide oklch from html2canvas
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function(el, pseudoElt) {
    const computedStyle = originalGetComputedStyle.call(window, el, pseudoElt);
    return new Proxy(computedStyle, {
      get(target: any, prop: string | symbol) {
        const val = target[prop];
        if (typeof val === 'function') {
          if (prop === 'getPropertyValue') {
            return function(p: string) {
              const v = target.getPropertyValue(p);
              if (v && typeof v === 'string' && v.includes('oklch')) return 'rgba(0,0,0,0)';
              return v;
            };
          }
          return val.bind(target);
        }
        if (typeof val === 'string' && val.includes('oklch')) {
          return 'rgba(0,0,0,0)';
        }
        return val;
      }
    });
  };
  
  return new Promise((resolve, reject) => {
    // Need to use flushSync or setTimeout to ensure DOM is updated
    root.render(<PDFTemplate document={document} client={client} profile={profile} type={type} />);
    
    setTimeout(async () => {
      try {
        const element = container.querySelector('#pdf-template-container');
        if (!element) throw new Error('Template not rendered');

        const opt = {
          margin:       [0, 0, 0, 0],
          filename:     `${type.toLowerCase()}-${document.invoiceNumber || document.quoteNumber || document.localId?.slice(0,8)}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, logging: false },
          jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        if (download) {
          await html2pdf().set(opt).from(element).save();
          resolve();
        } else {
          // generate base64
          const pdfBase64 = await html2pdf().set(opt).from(element).output('datauristring');
          resolve(pdfBase64);
        }
      } catch (err) {
        reject(err);
      } finally {
        setTimeout(() => {
          root.unmount();
          window.document.body.removeChild(container);
          window.getComputedStyle = originalGetComputedStyle;
        }, 0);
      }
    }, 500); // give time for images and fonts to load
  });
};
