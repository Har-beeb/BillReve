import json

file_path = r'D:\My Document\VsCode\BillReve\client\vite.config.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("import packageJson from './package.json'\n", "")
content = content.replace("JSON.stringify(packageJson.version)", "JSON.stringify('1.6.0')")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed vite config")
