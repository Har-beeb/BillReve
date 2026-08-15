import re

file_path = r'D:\My Document\VsCode\BillReve\client\vite.config.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

if "import packageJson from './package.json'" not in content:
    content = "import packageJson from './package.json'\n" + content

if "define:" not in content:
    content = content.replace('plugins: [', "define: {\n    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)\n  },\n  plugins: [")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated vite config")
