const fs = require('fs');
const lines = fs.readFileSync('admin.html', 'utf8').split('\n');

let depth = 0;
let tabStack = [];

lines.forEach((line, i) => {
  const lineNum = i + 1;
  const divOpens = (line.match(/<div(\s|>)/gi) || []).length;
  const divCloses = (line.match(/<\/div>/gi) || []).length;
  
  if (line.includes('activeTab ===')) {
    console.log(`Line ${lineNum}: FOUND TAB -> ${line.trim()} [Depth BEFORE: ${depth}]`);
  }

  depth += (divOpens - divCloses);

  if (line.includes('activeTab ===')) {
    console.log(`Line ${lineNum}: Depth AFTER: ${depth}`);
  }
});

console.log(`Final div balance (should be 0): ${depth}`);
