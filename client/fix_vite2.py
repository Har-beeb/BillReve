import json

file_path = r'D:\My Document\VsCode\BillReve\client\vite.config.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("JSON.stringify('1.6.0')", "JSON.stringify(JSON.parse(require('fs').readFileSync('./package.json', 'utf-8')).version)")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed vite config")
