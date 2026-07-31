const fs = require('fs');
let content = fs.readFileSync('client/src/pages/Settings.tsx', 'utf8');

// 1. Import useNavigate
if (!content.includes('react-router-dom')) {
  content = content.replace(
    "import React, { useState, useEffect } from 'react';",
    "import React, { useState, useEffect } from 'react';\nimport { useNavigate } from 'react-router-dom';"
  );
}

// 2. Add const navigate = useNavigate();
if (!content.includes('const navigate = useNavigate();')) {
  content = content.replace(
    "const [activeTab, setActiveTab]",
    "const navigate = useNavigate();\n  const [activeTab, setActiveTab]"
  );
}

// 3. Replace <a href="/upgrade">
content = content.replace(
  /<a href="\/upgrade" className="([^"]+)">View Pro Plan<\/a>/,
  '<button onClick={() => navigate(\'/upgrade\')} className="$1">View Pro Plan</button>'
);

// 4. Remove isSendingMarketing state
content = content.replace(
  /\s*const \[isSendingMarketing, setIsSendingMarketing\] = useState\(false\);\n/,
  '\n'
);

// 5. Remove handleTestMarketingEmail function
content = content.replace(
  /\s*const handleTestMarketingEmail = async \(\) => \{[\s\S]*?setIsSendingMarketing\(false\);\s*\}\s*\};\n/,
  '\n'
);

// 6. Remove Test Marketing Email button
content = content.replace(
  /\s*<button\s*onClick=\{handleTestMarketingEmail\}[\s\S]*?Test Marketing Email\s*<\/button>/,
  ''
);

fs.writeFileSync('client/src/pages/Settings.tsx', content);
