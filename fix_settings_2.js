const fs = require('fs');
let content = fs.readFileSync('client/src/pages/Settings.tsx', 'utf8');

// Fix ProFeature wrapper in Color Theme
content = content.replace(
  /<ProFeature isProUser=\{isProUser\} className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:col-span-2">\s*<label className=\{`cursor-pointer/g,
  '<ProFeature isProUser={isProUser} className="sm:col-span-2">\n                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">\n                  <label className={`cursor-pointer'
);
content = content.replace(
  /                  <\/ProFeature>\r?\n                <\/div>\r?\n\r?\n                <div className="pt-6 mt-6 border-t/g,
  '                    </div>\n                  </ProFeature>\n                </div>\n\n                <div className="pt-6 mt-6 border-t'
);

fs.writeFileSync('client/src/pages/Settings.tsx', content);
