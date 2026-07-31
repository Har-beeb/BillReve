const fs = require('fs');
let content = fs.readFileSync('client/src/pages/Settings.tsx', 'utf8');

content = content.replace(
  "import { Trash2, useAppStore } from '../store/useAppStore';",
  "import { Trash2, useAppStore } from '../store/useAppStore';\nimport { CsvImportWizard } from '../components/CsvImportWizard';\nimport { FileUp } from 'lucide-react';"
);

// We need a state for the wizard
content = content.replace(
  "const { user } = useAuth();",
  "const { user } = useAuth();\n  const [showImportWizard, setShowImportWizard] = useState(false);"
);

// We need to add the Data Migration section
const insertTarget = `                      Generate Mock Data
                    </button>
                  </div>
                </div>`;

const dataMigrationBlock = `
                {/* Data Migration */}
                <div className="w-full bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 mt-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 text-left">
                  <div>
                    <div className="text-sm font-medium text-blue-700 dark:text-blue-400">Data Migration</div>
                    <div className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1 max-w-lg">
                      Import your clients, invoices, or quotes from QuickBooks, Wave, or any other system using our CSV Import Wizard.
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                    <button 
                      onClick={() => setShowImportWizard(true)}
                      className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap w-full sm:w-auto"
                    >
                      <FileUp size={16} />
                      Import CSV
                    </button>
                  </div>
                </div>`;

content = content.replace(insertTarget, insertTarget + dataMigrationBlock);

// Finally, render the wizard
const wizardRender = `
      {showImportWizard && (
        <CsvImportWizard onClose={() => setShowImportWizard(false)} />
      )}`;

content = content.replace(
  "export default Settings;",
  wizardRender + "\n\nexport default Settings;"
);

fs.writeFileSync('client/src/pages/Settings.tsx', content);
console.log('Updated Settings.tsx successfully');
