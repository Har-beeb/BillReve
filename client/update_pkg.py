import json
import os

pkg_path = r'D:\My Document\VsCode\BillReve\client\package.json'
with open(pkg_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

data['version'] = '1.6.0'

with open(pkg_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print("Updated package.json version")
