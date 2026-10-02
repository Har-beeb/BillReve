import json

with open(r'C:\Users\Rahmah\.gemini\antigravity\brain\8d236569-3574-4232-962c-4e086dc9021b\billreve_documentation.md', 'r', encoding='utf-8') as f:
    content = f.read()

js_string = json.dumps(content)

new_file = f"""import React from 'react';
import {{ SEO }} from '../../components/SEO';
import ReactMarkdown from 'react-markdown';

export const billreveDocMarkdown = {js_string};

const Documentation: React.FC = () => {{
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <SEO title="Documentation" />
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-12 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="prose prose-purple dark:prose-invert max-w-none">
          <ReactMarkdown>{{billreveDocMarkdown}}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}};

export default Documentation;
"""

with open(r'd:\My Document\VsCode\BillReve\client\src\pages\public\Documentation.tsx', 'w', encoding='utf-8') as f:
    f.write(new_file)
