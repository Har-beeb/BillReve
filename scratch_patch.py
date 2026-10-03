import re
import os

files = [
    'client/src/components/SendDocumentModal.tsx',
    'client/src/pages/Invoices.tsx',
    'client/src/pages/PublicInvoice.tsx',
    'client/src/pages/PublicQuote.tsx',
    'client/src/pages/Quotes.tsx'
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove the import line
    import_regex = re.compile(r"import\s+\{\s*generateDocumentPdf\s*\}\s+from\s+['\"](?:\.\./)+utils/pdfGenerator['\"];\n?")
    content = import_regex.sub('', content)

    # Replace the call
    content = content.replace('await generateDocumentPdf(', '(await import(\'../utils/pdfGenerator\')).generateDocumentPdf(')
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Patched', file)
