import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { UploadCloud, CheckCircle, ArrowRight, Database } from 'lucide-react';
import { parseCSV, downloadTemplate, type ImportType } from '../utils/csvParser';
import { useAppStore } from '../store/useAppStore';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

interface CsvImportWizardProps {
  onClose: () => void;
  defaultType?: ImportType;
}

export const CsvImportWizard: React.FC<CsvImportWizardProps> = ({ onClose, defaultType = 'clients' }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importType, setImportType] = useState<ImportType>(defaultType);
    const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const { addClient, addInvoice } = useAppStore();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
        setIsProcessing(true);
    
    try {
      const results = await parseCSV(selectedFile);
      if (results.data && results.data.length > 0) {
        setCsvData(results.data);
        setHeaders(results.meta.fields || Object.keys(results.data[0]));
        setStep(2);
      } else {
        toast.error('The CSV file appears to be empty.');
      }
    } catch (err: any) {
      toast.error('Error parsing CSV: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    setIsProcessing(true);
    
    try {
      let importedCount = 0;
      
      if (importType === 'clients') {
        for (const row of csvData) {
          if (!row['Name'] && !row['name']) continue; // Skip empty rows
          addClient({
            localId: uuidv4(),
            name: row['Name'] || row['name'] || 'Unknown Client',
            email: row['Email'] || row['email'] || '',
            phone: row['Phone'] || row['phone'] || '',
            address: row['Address'] || row['address'] || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncStatus: 'pending'
          });
          importedCount++;
        }
      } else if (importType === 'invoices') {
        for (const row of csvData) {
          if (!row['Invoice Number'] && !row['invoice_number']) continue;
          const itemQty = parseFloat(row['Item 1 Quantity'] || row['quantity'] || '1');
          const itemPrice = parseFloat(row['Item 1 Price'] || row['price'] || '0');
          addInvoice({
            localId: uuidv4(),
            clientId: uuidv4(), // Need to map to real client ideally
            invoiceNumber: row['Invoice Number'] || row['invoice_number'] || `INV-${Math.floor(Math.random() * 1000)}`,
            issuedAt: row['Issue Date'] || row['issue_date'] || new Date().toISOString().split('T')[0],
            dueDate: row['Due Date'] || row['due_date'] || new Date().toISOString().split('T')[0],
            status: 'DRAFT',
            currency: row['Currency'] || row['currency'] || 'USD',
            items: [
              {
                id: uuidv4(),
                description: row['Item 1 Description'] || row['description'] || 'Imported Item',
                quantity: itemQty,
                unitPrice: itemPrice,
                amount: itemQty * itemPrice
              }
            ],
            subtotal: itemQty * itemPrice,
            taxes: [],
            total: itemQty * itemPrice,
            amountPaid: 0,
            isRecurring: false,
            notes: row['Notes'] || row['notes'] || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncStatus: 'pending'
          });
          importedCount++;
        }
      }
      
      toast.success(`Successfully imported ${importedCount} ${importType}!`);
      onClose();
    } catch (err: any) {
      toast.error('Error during import: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database size={24} className="text-purple-600" />
            Import Data
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Stepper */}
          <div className="flex items-center justify-center mb-8">
            <div className={`flex items-center ${step >= 1 ? 'text-purple-600' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>1</div>
              <span className="ml-2 font-medium">Upload</span>
            </div>
            <div className={`w-16 h-1 mx-4 ${step >= 2 ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
            <div className={`flex items-center ${step >= 2 ? 'text-purple-600' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>2</div>
              <span className="ml-2 font-medium">Review</span>
            </div>
            <div className={`w-16 h-1 mx-4 ${step >= 3 ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
            <div className={`flex items-center ${step >= 3 ? 'text-purple-600' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 3 ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>3</div>
              <span className="ml-2 font-medium">Import</span>
            </div>
          </div>

          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">What are you importing?</label>
                <div className="flex gap-4">
                  {(['clients', 'invoices', 'quotes'] as const).map(type => (
                    <label key={type} className={`flex-1 cursor-pointer border rounded-xl p-4 text-center transition-all ${importType === type ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <input 
                        type="radio" 
                        name="importType" 
                        value={type} 
                        checked={importType === type}
                        onChange={() => setImportType(type)}
                        className="sr-only"
                      />
                      <span className="block font-medium capitalize text-slate-900 dark:text-white mb-1">{type}</span>
                      <button onClick={(e) => { e.preventDefault(); downloadTemplate(type); }} className="text-xs text-purple-600 hover:underline">Download Template</button>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors relative group">
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="pointer-events-none flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {isProcessing ? <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div> : <UploadCloud size={32} />}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Click or drag CSV file here</h3>
                  <p className="text-slate-500 text-sm">Must be a comma-separated values file (.csv)</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Review */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Review Data</h3>
                  <p className="text-slate-500 text-sm">Found {csvData.length} records. Please verify the preview below.</p>
                </div>
                <button onClick={() => setStep(3)} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold transition-colors flex items-center gap-2">
                  Continue <ArrowRight size={18} />
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      {headers.map((h, i) => <th key={i} className="p-3 font-medium border-b border-slate-200 dark:border-slate-700">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-slate-200 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {headers.map((h, j) => <td key={j} className="p-3 text-slate-900 dark:text-white">{row[h] || '-'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvData.length > 5 && (
                <div className="text-center text-sm text-slate-500 italic">Showing 5 of {csvData.length} rows</div>
              )}
            </div>
          )}

          {/* Step 3: Import */}
          {step === 3 && (
            <div className="space-y-6 text-center py-8">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 mx-auto flex items-center justify-center mb-6">
                <CheckCircle size={40} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Ready to Import!</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
                You are about to import <strong className="text-slate-900 dark:text-white">{csvData.length}</strong> {importType} into your BillReve workspace.
import toast from 'react-hot-toast';
              </p>

              <div className="flex justify-center gap-4">
                <button onClick={() => setStep(2)} className="px-6 py-3 rounded-lg font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
                  Go Back
                </button>
                <button onClick={handleImport} disabled={isProcessing} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-lg flex items-center gap-2">
                  {isProcessing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <CheckCircle size={20} />}
                  {isProcessing ? 'Importing...' : 'Confirm Import'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
};
