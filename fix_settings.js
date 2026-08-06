const fs = require('fs');
let content = fs.readFileSync('client/src/pages/Settings.tsx', 'utf8');

// Fix ProFeature wrapper in Color Theme
content = content.replace(
  '<ProFeature isProUser={isProUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:col-span-2">\n                  <label className={`cursor-pointer',
  '<ProFeature isProUser={isProUser} className="sm:col-span-2">\n                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">\n                  <label className={`cursor-pointer'
);
content = content.replace(
  '                  </ProFeature>\n                </div>\n\n                <div className="pt-6 mt-6 border-t',
  '                  </div>\n                  </ProFeature>\n                </div>\n\n                <div className="pt-6 mt-6 border-t'
);

// Fix Typography ProFeature wrapper
content = content.replace(
  '<ProFeature isProUser={isProUser} className="grid grid-cols-1 md:grid-cols-2 gap-6">',
  '<ProFeature isProUser={isProUser}>\n                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">'
);
content = content.replace(
  '                  </ProFeature>\n                </div>\n              </div>\n            </div>\n          )}',
  '                    </div>\n                  </ProFeature>\n                </div>\n              </div>\n            </div>\n          )}'
);

// Fix Vibrant Violet color circle to shrink-0
content = content.replace(
  '<div className="w-4 h-4 rounded-full bg-[#9333ea]"></div>',
  '<div className="w-4 h-4 shrink-0 rounded-full bg-[#9333ea]"></div>'
);
content = content.replace(
  '<div className="w-4 h-4 rounded-full bg-pink-800"></div>',
  '<div className="w-4 h-4 shrink-0 rounded-full bg-pink-800"></div>'
);
content = content.replace(
  '<div className="w-4 h-4 rounded-full bg-blue-600"></div>',
  '<div className="w-4 h-4 shrink-0 rounded-full bg-blue-600"></div>'
);
content = content.replace(
  '<div className="w-4 h-4 rounded-full bg-emerald-600"></div>',
  '<div className="w-4 h-4 shrink-0 rounded-full bg-emerald-600\"></div>'
);
content = content.replace(
  '<div className="w-4 h-4 rounded-full bg-slate-700"></div>',
  '<div className="w-4 h-4 shrink-0 rounded-full bg-slate-700\"></div>'
);
content = content.replace(
  '<div className="w-4 h-4 rounded-full bg-orange-500"></div>',
  '<div className="w-4 h-4 shrink-0 rounded-full bg-orange-500\"></div>'
);
content = content.replace(
  '<div className="w-4 h-4 rounded-full bg-yellow-500"></div>',
  '<div className="w-4 h-4 shrink-0 rounded-full bg-yellow-500\"></div>'
);
content = content.replace(
  '<div className="w-4 h-4 rounded-full bg-red-600"></div>',
  '<div className="w-4 h-4 shrink-0 rounded-full bg-red-600\"></div>'
);
content = content.replace(
  '<div className="w-4 h-4 rounded-full" style={{ backgroundColor: customColor || \'#8b5cf6\' }}></div>',
  '<div className="w-4 h-4 shrink-0 rounded-full" style={{ backgroundColor: customColor || \'#8b5cf6\' }}></div>'
);

fs.writeFileSync('client/src/pages/Settings.tsx', content);
