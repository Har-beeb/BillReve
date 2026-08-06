const fs = require('fs');
const lines = fs.readFileSync('client/src/pages/Settings.tsx', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes("{activeTab === 'sync' && ("));
if (start !== -1) {
  console.log('FOUND AT LINE: ' + start);
  console.log(lines.slice(start+40, start + 80).join('\n'));
}
