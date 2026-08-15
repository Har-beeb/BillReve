import json

file_path = r'D:\My Document\VsCode\BillReve\client\src\pages\public\Documentation.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('export const billreveDocMarkdown = ', 'export const billreveDocMarkdown = ')
content = content.replace(';\n\nconst Documentation: React.FC', ';\n\nconst Documentation: React.FC')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed backticks")
