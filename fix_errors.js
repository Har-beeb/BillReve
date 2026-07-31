const fs = require('fs');

// --- 1. Fix CsvImportWizard.tsx ---
let csvContent = fs.readFileSync('client/src/components/CsvImportWizard.tsx', 'utf8');

// 1.1 Remove unused imports
csvContent = csvContent.replace(
  "import { UploadCloud, CheckCircle, FileText, ArrowRight, AlertTriangle } from 'lucide-react';",
  "import { UploadCloud, CheckCircle, ArrowRight, Database } from 'lucide-react';"
);

csvContent = csvContent.replace(
  "import Papa from 'papaparse';\n",
  ""
);

csvContent = csvContent.replace(
  "import { parseCSV, downloadTemplate, ImportType } from '../utils/csvParser';",
  "import { parseCSV, downloadTemplate, type ImportType } from '../utils/csvParser';"
);

// 1.2 Fix useAppStore destructuring
csvContent = csvContent.replace(
  "const { addClient, addInvoice, addQuote } = useAppStore();",
  "const { addClient, addInvoice } = useAppStore();"
);

// 1.3 Remove unused 'file' state
csvContent = csvContent.replace(
  "const [file, setFile] = useState<File | null>(null);\n",
  ""
);
csvContent = csvContent.replace(
  "setFile(selectedFile);\n",
  ""
);

// 1.4 Fix addClient
const oldClient = `addClient({
            id: uuidv4(),
            name: row['Name'] || row['name'] || 'Unknown Client',
            email: row['Email'] || row['email'] || '',
            phone: row['Phone'] || row['phone'] || '',
            address: row['Address'] || row['address'] || '',
            company: row['Company'] || row['company'] || '',
            createdAt: new Date().toISOString()
          });`;

const newClient = `addClient({
            localId: uuidv4(),
            name: row['Name'] || row['name'] || 'Unknown Client',
            email: row['Email'] || row['email'] || '',
            phone: row['Phone'] || row['phone'] || '',
            address: row['Address'] || row['address'] || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncStatus: 'pending'
          });`;
csvContent = csvContent.replace(oldClient, newClient);

// 1.5 Fix addInvoice
const oldInvoice = `addInvoice({
            id: uuidv4(),
            clientId: uuidv4(), // Need to map to real client ideally
            number: row['Invoice Number'] || row['invoice_number'] || \`INV-\${Math.floor(Math.random() * 1000)}\`,
            issueDate: row['Issue Date'] || row['issue_date'] || new Date().toISOString().split('T')[0],
            dueDate: row['Due Date'] || row['due_date'] || new Date().toISOString().split('T')[0],
            status: (row['Status'] || row['status'] || 'pending').toLowerCase() as any,
            currency: row['Currency'] || row['currency'] || 'USD',
            items: [
              {
                id: uuidv4(),
                description: row['Item 1 Description'] || row['description'] || 'Imported Item',
                quantity: parseFloat(row['Item 1 Quantity'] || row['quantity'] || '1'),
                price: parseFloat(row['Item 1 Price'] || row['price'] || '0')
              }
            ],
            subtotal: parseFloat(row['Item 1 Price'] || row['price'] || '0'),
            taxTotal: 0,
            total: parseFloat(row['Item 1 Price'] || row['price'] || '0'),
            notes: row['Notes'] || row['notes'] || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'import'
          });`;
          
const newInvoice = `const itemQty = parseFloat(row['Item 1 Quantity'] || row['quantity'] || '1');
          const itemPrice = parseFloat(row['Item 1 Price'] || row['price'] || '0');
          addInvoice({
            localId: uuidv4(),
            clientId: uuidv4(), // Need to map to real client ideally
            invoiceNumber: row['Invoice Number'] || row['invoice_number'] || \`INV-\${Math.floor(Math.random() * 1000)}\`,
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
          });`;
csvContent = csvContent.replace(oldInvoice, newInvoice);

fs.writeFileSync('client/src/components/CsvImportWizard.tsx', csvContent);
console.log('Fixed CsvImportWizard.tsx');


// --- 2. Fix Settings.tsx ---
let settingsContent = fs.readFileSync('client/src/pages/Settings.tsx', 'utf8');

// 2.1 Remove unused Mail import
settingsContent = settingsContent.replace(
  "Mail, Database, Settings as SettingsIcon",
  "Database, Settings as SettingsIcon"
);

// 2.2 Add import for CsvImportWizard
if (!settingsContent.includes("import { CsvImportWizard }")) {
  settingsContent = settingsContent.replace(
    "import { Trash2, useAppStore } from '../store/useAppStore';",
    "import { Trash2, useAppStore } from '../store/useAppStore';\nimport { CsvImportWizard } from '../components/CsvImportWizard';\nimport { FileUp } from 'lucide-react';"
  );
}

// 2.3 Add state for showImportWizard
if (!settingsContent.includes("const [showImportWizard, setShowImportWizard] = useState(false);")) {
  // Find where useAuth is called or where the component starts
  const match = settingsContent.match(/const Settings = \(\) => \{\n/);
  if (match) {
    settingsContent = settingsContent.replace(
      match[0],
      match[0] + "  const [showImportWizard, setShowImportWizard] = useState(false);\n"
    );
  }
}

// 2.4 Add rendering code if missing (I already added it at the bottom outside the component scope previously!)
// Wait, in my previous script I added it at the VERY END of the file, replacing "export default Settings;"
// So it ended up outside the component body! That's why it failed with Cannot find name!
// Let me remove it from the end of the file.
settingsContent = settingsContent.replace(
  /      \{showImportWizard && \(\n        <CsvImportWizard onClose=\{\(\) => setShowImportWizard\(false\)\} \/>\n      \)\}\n\nexport default Settings;/,
  "export default Settings;"
);

// Now insert it correctly at the end of the component's main return div.
const endOfReturn = `        </div>
      </div>
    </div>
  );
};`;
const correctRender = `        </div>
      </div>
      {showImportWizard && (
        <CsvImportWizard onClose={() => setShowImportWizard(false)} />
      )}
    </div>
  );
};`;
settingsContent = settingsContent.replace(endOfReturn, correctRender);

fs.writeFileSync('client/src/pages/Settings.tsx', settingsContent);
console.log('Fixed Settings.tsx');
