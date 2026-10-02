import re

with open(r'd:\My Document\VsCode\BillReve\client\src\pages\public\Documentation.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add useLocation import if needed
if "useLocation" not in content:
    content = content.replace("import React from 'react';", "import React, { useEffect } from 'react';\nimport { useLocation } from 'react-router-dom';")

# Add the hook inside the component
if "const { hash } = useLocation();" not in content:
    old_comp = "const Documentation: React.FC = () => {"
    new_comp = """const Documentation: React.FC = () => {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      setTimeout(() => {
        const id = hash.replace('#', '');
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [hash]);
"""
    content = content.replace(old_comp, new_comp)

with open(r'd:\My Document\VsCode\BillReve\client\src\pages\public\Documentation.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
