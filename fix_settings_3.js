const fs = require('fs');
let content = fs.readFileSync('client/src/pages/Settings.tsx', 'utf8');
content = content.replace(/className=\"w-4 h-4 rounded-full/g, 'className=\"w-4 h-4 shrink-0 rounded-full');
fs.writeFileSync('client/src/pages/Settings.tsx', content);
