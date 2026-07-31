const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

const OLD_CLASSES = 'bg-purple-600 hover:bg-purple-700 text-white';
const NEW_CLASSES = 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white border-0 shadow-md';

walk('client/src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // 1. Replace button backgrounds
    if (content.includes('bg-purple-600 hover:bg-purple-700 text-white')) {
      content = content.replace(/bg-purple-600 hover:bg-purple-700 text-white/g, NEW_CLASSES);
      changed = true;
    }
    
    // 2. Also replace "bg-purple-600 hover:bg-purple-700" if "text-white" isn't exactly next to it
    if (content.includes('bg-purple-600 hover:bg-purple-700') && !content.includes(NEW_CLASSES)) {
       content = content.replace(/bg-purple-600 hover:bg-purple-700/g, 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 shadow-md');
       changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated buttons in', filePath);
    }
  }
});
