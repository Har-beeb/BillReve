import re

with open(r'd:\My Document\VsCode\BillReve\client\src\pages\public\Documentation.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports if they don't exist
if 'remarkGfm' not in content:
    content = content.replace("import ReactMarkdown from 'react-markdown';", "import ReactMarkdown from 'react-markdown';\nimport remarkGfm from 'remark-gfm';\nimport rehypeSlug from 'rehype-slug';")

# Replace ReactMarkdown component call
old_rm = "<ReactMarkdown>{billreveDocMarkdown}</ReactMarkdown>"
new_rm = """<ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSlug]}
          >
            {billreveDocMarkdown}
          </ReactMarkdown>"""
content = content.replace(old_rm, new_rm)

with open(r'd:\My Document\VsCode\BillReve\client\src\pages\public\Documentation.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
